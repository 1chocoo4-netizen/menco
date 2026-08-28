// 멘코 온라인 음성 코칭 서버(server.js)가 세션 종료 시 호출하는 내부 전용 엔드포인트.
// 브라우저에서 직접 호출하지 않으며, x-internal-token 헤더로 서버 간 호출만 허용한다.

import { NextRequest, NextResponse } from "next/server";
import { addParticipant, addSession } from "@/lib/offline-store";
import type { Gender } from "@/lib/mock-data";

const VALID_GENDERS: Gender[] = ["female", "male", "unspecified"];

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-internal-token");
  if (!process.env.INTERNAL_API_TOKEN || token !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const gender: Gender = VALID_GENDERS.includes(body?.gender) ? body.gender : "unspecified";
  const age = Number(body?.age);
  const transcript = typeof body?.transcript === "string" ? body.transcript : "";

  if (!transcript.trim() || !Number.isFinite(age) || age <= 0 || age > 120) {
    return NextResponse.json({ error: "age(1~120), transcript가 필요합니다." }, { status: 400 });
  }

  const afterParticipant = await addParticipant({ gender, age, source: "online" });
  const participant = afterParticipant.participants.at(-1);
  if (!participant) {
    return NextResponse.json({ error: "참가자 생성 실패" }, { status: 500 });
  }

  await addSession({
    participantId: participant.id,
    date: new Date().toISOString().slice(0, 10),
    transcript,
    coachOpinion: "",
  });

  return NextResponse.json({ participantId: participant.id });
}
