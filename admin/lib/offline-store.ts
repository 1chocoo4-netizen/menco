// 오프라인 연구 데이터 저장소.
// Supabase 등 실 DB가 붙기 전까지, admin/data/offline-research.json 파일에 직접 저장한다.
// ⚠️ next start로 상시 구동되는 서버(예: Render)에서는 정상 동작하지만, Vercel 등
// 서버리스/읽기전용 파일시스템 배포 환경에서는 쓰기가 유지되지 않으므로 주의.

import { promises as fs } from "fs";
import path from "path";
import type { Gender } from "./mock-data";
import type { AnalyzeSessionResult } from "./gemini-analysis";
import type { SurveyScoreResult } from "./survey";

// Render 등에 배포할 때 영구 디스크(persistent disk)를 마운트한 절대경로를
// DATA_DIR 환경변수로 지정할 수 있다. 미지정 시 로컬 개발 기본값(./data)을 쓴다.
const DATA_DIR = process.env.DATA_DIR ? process.env.DATA_DIR : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "offline-research.json");

export interface OfflineParticipant {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  createdAt: string;
  /** "offline" = 연구자가 직접 등록, "online" = 멘코 음성 코칭 앱에서 세션 종료 시 자동 등록 */
  source: "offline" | "online";
}

export interface OfflineSession {
  id: string;
  participantId: string;
  date: string;
  transcript: string;
  coachOpinion: string;
  aiAnalysis: AnalyzeSessionResult | null;
  createdAt: string;
}

export interface OfflineSurveyResponse {
  id: string;
  participantId: string;
  sessionId: string;
  type: "pre" | "post";
  answers: Record<number, number>;
  result: SurveyScoreResult;
  createdAt: string;
}

export interface OfflineData {
  participants: OfflineParticipant[];
  sessions: OfflineSession[];
  surveys: OfflineSurveyResponse[];
}

const EMPTY_DATA: OfflineData = { participants: [], sessions: [], surveys: [] };

// 동시 쓰기로 인한 경합을 막기 위한 초간단 락(순차 실행 큐).
let writeQueue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.catch(() => undefined);
  return result;
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(EMPTY_DATA, null, 2), "utf-8");
  }
}

export async function readOfflineData(): Promise<OfflineData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw) as OfflineData;
  } catch {
    return { ...EMPTY_DATA };
  }
}

async function writeOfflineData(data: OfflineData) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function addParticipant(input: {
  name?: string;
  gender: Gender;
  age: number;
  source?: "offline" | "online";
}): Promise<OfflineData> {
  return withLock(async () => {
    const data = await readOfflineData();
    const id = genId("P");
    const source = input.source ?? "offline";
    data.participants.push({
      id,
      name: input.name?.trim() || `온라인-${id.slice(-4).toUpperCase()}`,
      gender: input.gender,
      age: input.age,
      createdAt: new Date().toISOString(),
      source,
    });
    await writeOfflineData(data);
    return data;
  });
}

export function deleteParticipant(participantId: string): Promise<OfflineData> {
  return withLock(async () => {
    const data = await readOfflineData();
    const removedSessionIds = new Set(
      data.sessions.filter((s) => s.participantId === participantId).map((s) => s.id)
    );
    data.participants = data.participants.filter((p) => p.id !== participantId);
    data.sessions = data.sessions.filter((s) => s.participantId !== participantId);
    data.surveys = data.surveys.filter(
      (s) => s.participantId !== participantId && !removedSessionIds.has(s.sessionId)
    );
    await writeOfflineData(data);
    return data;
  });
}

export function deleteSession(sessionId: string): Promise<OfflineData> {
  return withLock(async () => {
    const data = await readOfflineData();
    data.sessions = data.sessions.filter((s) => s.id !== sessionId);
    data.surveys = data.surveys.filter((s) => s.sessionId !== sessionId);
    await writeOfflineData(data);
    return data;
  });
}

export function addSession(input: {
  participantId: string;
  date: string;
  transcript: string;
  coachOpinion: string;
}): Promise<OfflineData> {
  return withLock(async () => {
    const data = await readOfflineData();
    data.sessions.push({
      id: genId("S"),
      participantId: input.participantId,
      date: input.date,
      transcript: input.transcript,
      coachOpinion: input.coachOpinion,
      aiAnalysis: null,
      createdAt: new Date().toISOString(),
    });
    await writeOfflineData(data);
    return data;
  });
}

export function updateSession(
  sessionId: string,
  patch: Partial<Pick<OfflineSession, "coachOpinion" | "transcript" | "aiAnalysis">>
): Promise<OfflineData> {
  return withLock(async () => {
    const data = await readOfflineData();
    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error("세션을 찾을 수 없습니다.");
    Object.assign(session, patch);
    await writeOfflineData(data);
    return data;
  });
}

export function addSurveyResponse(input: {
  participantId: string;
  sessionId: string;
  type: "pre" | "post";
  answers: Record<number, number>;
  result: SurveyScoreResult;
}): Promise<OfflineData> {
  return withLock(async () => {
    const data = await readOfflineData();
    // 동일 세션·동일 유형(pre/post) 재제출 시 기존 응답을 대체한다.
    data.surveys = data.surveys.filter(
      (s) => !(s.sessionId === input.sessionId && s.type === input.type)
    );
    data.surveys.push({
      id: genId("SV"),
      participantId: input.participantId,
      sessionId: input.sessionId,
      type: input.type,
      answers: input.answers,
      result: input.result,
      createdAt: new Date().toISOString(),
    });
    await writeOfflineData(data);
    return data;
  });
}
