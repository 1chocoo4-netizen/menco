"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SurveyDialog } from "@/components/offline/SurveyDialog";
import { genderLabels, type Gender } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Plus, Sparkles, Trash2, UserRound } from "lucide-react";
import type { OfflineData, OfflineParticipant, OfflineSession } from "@/lib/offline-store";

const GENDER_OPTIONS: Gender[] = ["female", "male", "unspecified"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function OfflineResearchPage() {
  const [data, setData] = useState<OfflineData | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<Gender>("female");
  const [newAge, setNewAge] = useState("");
  const [creatingParticipant, setCreatingParticipant] = useState(false);

  const [creatingSession, setCreatingSession] = useState(false);
  const [editBuffers, setEditBuffers] = useState<Record<string, { transcript: string; coachOpinion: string }>>({});
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);
  const [analyzingSessionId, setAnalyzingSessionId] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<Record<string, string>>({});

  const [surveyTarget, setSurveyTarget] = useState<{ sessionId: string; participantId: string; type: "pre" | "post" } | null>(null);
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

  useEffect(() => {
    fetch("/api/offline/data")
      .then((r) => r.json())
      .then((d: OfflineData) => setData(d));
  }, []);

  const participants = data?.participants ?? [];
  const sessions = data?.sessions ?? [];
  const surveys = data?.surveys ?? [];

  const selectedParticipant = participants.find((p) => p.id === selectedParticipantId) ?? null;
  const participantSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.participantId === selectedParticipantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions, selectedParticipantId]
  );

  function bufferFor(session: OfflineSession) {
    return editBuffers[session.id] ?? { transcript: session.transcript, coachOpinion: session.coachOpinion };
  }

  async function createParticipant() {
    const age = Number(newAge);
    if (!newName.trim() || !Number.isFinite(age) || age <= 0 || age > 120) return;
    setCreatingParticipant(true);
    try {
      const res = await fetch("/api/offline/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), gender: newGender, age }),
      });
      const d = await res.json();
      setData(d);
      setNewName("");
      setNewAge("");
      const created = (d as OfflineData).participants.at(-1);
      if (created) setSelectedParticipantId(created.id);
    } finally {
      setCreatingParticipant(false);
    }
  }

  async function createSession(participantId: string) {
    setCreatingSession(true);
    try {
      const res = await fetch("/api/offline/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, date: todayStr(), transcript: "", coachOpinion: "" }),
      });
      const d = await res.json();
      setData(d);
    } finally {
      setCreatingSession(false);
    }
  }

  async function saveSession(session: OfflineSession) {
    const buf = bufferFor(session);
    setSavingSessionId(session.id);
    try {
      const res = await fetch(`/api/offline/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buf),
      });
      const d = await res.json();
      setData(d);
    } finally {
      setSavingSessionId(null);
    }
  }

  async function runAnalysis(session: OfflineSession) {
    setAnalyzingSessionId(session.id);
    setAnalyzeError((prev) => ({ ...prev, [session.id]: "" }));
    try {
      const res = await fetch(`/api/offline/sessions/${session.id}/analyze`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setAnalyzeError((prev) => ({ ...prev, [session.id]: d.error ?? "분석 실패" }));
        return;
      }
      setData(d);
    } finally {
      setAnalyzingSessionId(null);
    }
  }

  async function deleteParticipant(participant: OfflineParticipant) {
    if (!window.confirm(`"${participant.name}" 참가자와 관련된 모든 세션·설문 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/offline/participants/${participant.id}`, { method: "DELETE" });
    const d = await res.json();
    setData(d);
    if (selectedParticipantId === participant.id) setSelectedParticipantId(null);
  }

  async function deleteSession(session: OfflineSession) {
    if (!window.confirm(`${session.date} 코칭 세션과 관련 설문 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/offline/sessions/${session.id}`, { method: "DELETE" });
    const d = await res.json();
    setData(d);
  }

  async function submitSurvey(answers: Record<number, number>) {
    if (!surveyTarget) return;
    setSubmittingSurvey(true);
    try {
      const res = await fetch("/api/offline/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...surveyTarget, answers }),
      });
      const d = await res.json();
      setData(d);
      setSurveyTarget(null);
    } finally {
      setSubmittingSurvey(false);
    }
  }

  return (
    <div>
      <Topbar
        title="오프라인 연구 데이터"
        description="대면 코칭 스크립트를 등록하고, 코칭 전/후 설문 + AI 분석 + 코치 소견을 기록합니다"
      />

      <div className="grid grid-cols-1 gap-4 p-4 md:p-8 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>참가자 등록</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="이름"
                className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
              />
              <div className="flex gap-1.5">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setNewGender(g)}
                    className={cn(
                      "flex-1 rounded-lg border px-2 py-1.5 text-xs transition-colors",
                      newGender === g
                        ? "border-transparent bg-gradient-to-br from-accent to-accent2 text-white font-medium"
                        : "border-border text-white/70 hover:bg-white/5"
                    )}
                  >
                    {genderLabels[g]}
                  </button>
                ))}
              </div>
              <input
                value={newAge}
                onChange={(e) => setNewAge(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="나이"
                inputMode="numeric"
                className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
              />
              <Button className="w-full justify-center" disabled={creatingParticipant} onClick={createParticipant}>
                <Plus size={15} />
                참가자 추가
              </Button>
            </div>
          </Card>

          <Card className="p-0">
            <div className="max-h-[520px] overflow-y-auto">
              {participants.length === 0 && (
                <p className="p-5 text-center text-xs text-muted">등록된 참가자가 없습니다.</p>
              )}
              {participants.map((p) => (
                <ParticipantRow
                  key={p.id}
                  participant={p}
                  active={p.id === selectedParticipantId}
                  sessionCount={sessions.filter((s) => s.participantId === p.id).length}
                  onClick={() => setSelectedParticipantId(p.id)}
                  onDelete={() => deleteParticipant(p)}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {!selectedParticipant && (
            <Card>
              <p className="py-10 text-center text-sm text-muted">왼쪽에서 참가자를 선택하거나 새로 등록하세요.</p>
            </Card>
          )}

          {selectedParticipant && (
            <>
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{selectedParticipant.name}</p>
                    <p className="text-xs text-muted">
                      {genderLabels[selectedParticipant.gender]} · 만 {selectedParticipant.age}세 · 코칭{" "}
                      {participantSessions.length}회
                    </p>
                  </div>
                  <Button disabled={creatingSession} onClick={() => createSession(selectedParticipant.id)}>
                    <Plus size={15} />
                    새 코칭 세션 추가
                  </Button>
                </div>
              </Card>

              {participantSessions.length === 0 && (
                <Card>
                  <p className="py-6 text-center text-sm text-muted">
                    아직 등록된 코칭 세션이 없습니다. &quot;새 코칭 세션 추가&quot;를 눌러 시작하세요.
                  </p>
                </Card>
              )}

              {participantSessions.map((session) => {
                const buf = bufferFor(session);
                const preSurvey = surveys.find((s) => s.sessionId === session.id && s.type === "pre");
                const postSurvey = surveys.find((s) => s.sessionId === session.id && s.type === "post");
                const dirty =
                  buf.transcript !== session.transcript || buf.coachOpinion !== session.coachOpinion;

                return (
                  <Card key={session.id}>
                    <CardHeader>
                      <div>
                        <CardTitle>코칭 세션 · {session.date}</CardTitle>
                        <CardDescription>세션 ID {session.id}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={preSurvey ? "outline" : "primary"}
                          onClick={() =>
                            setSurveyTarget({ sessionId: session.id, participantId: selectedParticipant.id, type: "pre" })
                          }
                        >
                          {preSurvey ? "코칭 전 설문 ✓ 다시 보기" : "코칭 전 설문 작성"}
                        </Button>
                        <Button
                          variant={postSurvey ? "outline" : "primary"}
                          onClick={() =>
                            setSurveyTarget({ sessionId: session.id, participantId: selectedParticipant.id, type: "post" })
                          }
                        >
                          {postSurvey ? "코칭 후 설문 ✓ 다시 보기" : "코칭 후 설문 작성"}
                        </Button>
                        <button
                          onClick={() => deleteSession(session)}
                          className="rounded-lg p-2 text-muted hover:bg-negative/15 hover:text-negative"
                          aria-label="세션 삭제"
                          title="세션 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </CardHeader>

                    {preSurvey && postSurvey && (
                      <div className="mb-5 rounded-xl border border-border bg-bg/40 p-4">
                        <p className="mb-3 text-xs font-medium text-muted">코칭 전/후 4C 카테고리 변화</p>
                        <div className="space-y-3">
                          {postSurvey.result.categoryScores.map((post) => {
                            const pre = preSurvey.result.categoryScores.find((c) => c.category === post.category);
                            const delta = post.score - (pre?.score ?? 0);
                            return (
                              <div key={post.category}>
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span className="text-white/80">{post.category}</span>
                                  <Badge tone={delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral"}>
                                    {pre?.score.toFixed(2)} → {post.score.toFixed(2)} ({delta > 0 ? "+" : ""}
                                    {delta.toFixed(2)})
                                  </Badge>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                                    style={{ width: `${(post.score / 10) * 100}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mb-4">
                      <p className="mb-1.5 text-xs font-medium text-muted">코칭 대화 스크립트</p>
                      <textarea
                        value={buf.transcript}
                        onChange={(e) =>
                          setEditBuffers((prev) => ({
                            ...prev,
                            [session.id]: { ...bufferFor(session), transcript: e.target.value },
                          }))
                        }
                        rows={6}
                        placeholder="오프라인 코칭 대화 스크립트를 붙여넣으세요."
                        className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white/90 placeholder:text-muted focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="mb-4">
                      <p className="mb-1.5 text-xs font-medium text-muted">멘탈코치 소견 (질적 분석)</p>
                      <textarea
                        value={buf.coachOpinion}
                        onChange={(e) =>
                          setEditBuffers((prev) => ({
                            ...prev,
                            [session.id]: { ...bufferFor(session), coachOpinion: e.target.value },
                          }))
                        }
                        rows={3}
                        placeholder="코치가 직접 관찰·해석한 내용을 기록하세요 (질적 연구 근거)."
                        className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white/90 placeholder:text-muted focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Button variant="outline" disabled={!dirty || savingSessionId === session.id} onClick={() => saveSession(session)}>
                        {savingSessionId === session.id ? "저장 중..." : "스크립트 · 소견 저장"}
                      </Button>
                      <Button
                        disabled={!session.transcript.trim() || analyzingSessionId === session.id}
                        onClick={() => runAnalysis(session)}
                      >
                        <Sparkles size={15} />
                        {analyzingSessionId === session.id ? "AI 분석 중..." : "AI 분석 실행"}
                      </Button>
                      {analyzeError[session.id] && (
                        <span className="text-xs text-negative">{analyzeError[session.id]}</span>
                      )}
                    </div>

                    {session.aiAnalysis && (
                      <div className="rounded-xl border border-border bg-bg/40 p-4">
                        <p className="mb-1 text-xs font-medium text-white/85">
                          코칭 시작 vs 종료 — 언어 기반 효과
                        </p>
                        <p className="mb-3 text-[11px] text-muted">
                          원문에서 실제로 등장한 감정 표현을 AI가 그대로 추출한 개수 비교 (창작·의역 없음)
                        </p>
                        <div className="mb-4 grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-negative/30 bg-negative/5 p-2.5">
                            <p className="mb-1 text-muted">부정 표현 개수</p>
                            <p className="text-sm font-semibold text-negative">
                              시작 {session.aiAnalysis.llm.earlySegmentCandidateWords.negative.length}개 → 종료{" "}
                              {session.aiAnalysis.llm.lateSegmentCandidateWords.negative.length}개
                            </p>
                          </div>
                          <div className="rounded-lg border border-positive/30 bg-positive/5 p-2.5">
                            <p className="mb-1 text-muted">긍정 표현 개수</p>
                            <p className="text-sm font-semibold text-positive">
                              시작 {session.aiAnalysis.llm.earlySegmentCandidateWords.positive.length}개 → 종료{" "}
                              {session.aiAnalysis.llm.lateSegmentCandidateWords.positive.length}개
                            </p>
                          </div>
                        </div>

                        <details className="mb-4">
                          <summary className="cursor-pointer text-xs text-muted hover:text-white/80">
                            추출된 표현 원문 보기
                          </summary>
                          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <p className="mb-1.5 text-[11px] font-medium text-muted">코칭 시작 (초반)</p>
                              <div className="flex flex-wrap gap-1">
                                {session.aiAnalysis.llm.earlySegmentCandidateWords.negative.map((w, i) => (
                                  <Badge key={`en${i}`} tone="negative">{w}</Badge>
                                ))}
                                {session.aiAnalysis.llm.earlySegmentCandidateWords.positive.map((w, i) => (
                                  <Badge key={`ep${i}`} tone="positive">{w}</Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="mb-1.5 text-[11px] font-medium text-muted">코칭 종료 (후반)</p>
                              <div className="flex flex-wrap gap-1">
                                {session.aiAnalysis.llm.lateSegmentCandidateWords.negative.map((w, i) => (
                                  <Badge key={`ln${i}`} tone="negative">{w}</Badge>
                                ))}
                                {session.aiAnalysis.llm.lateSegmentCandidateWords.positive.map((w, i) => (
                                  <Badge key={`lp${i}`} tone="positive">{w}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </details>

                        <details className="mb-4">
                          <summary className="cursor-pointer text-xs text-muted hover:text-white/80">
                            결정론적 사전 매칭 비율 (참고용 · {session.aiAnalysis.methodology.lexiconBasis})
                          </summary>
                          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-lg border border-border p-2.5">
                              <p className="mb-1 text-muted">초반 부정어 비율</p>
                              <p className="text-sm font-semibold text-negative">
                                {session.aiAnalysis.deterministic.early.negativeRatioPct}%
                              </p>
                            </div>
                            <div className="rounded-lg border border-border p-2.5">
                              <p className="mb-1 text-muted">후반 긍정어 비율</p>
                              <p className="text-sm font-semibold text-positive">
                                {session.aiAnalysis.deterministic.late.positiveRatioPct}%
                              </p>
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-muted">
                            데모용 소규모 사전이라 0%로 나올 수 있습니다. 실제 KNU 한국어 감성사전으로
                            교체하면 이 수치가 논문에 쓸 수 있는 정식 지표가 됩니다.
                          </p>
                        </details>

                        <p className="mb-2 text-xs font-medium text-white/85">
                          AI 스크립트 기반 4C 역량 · 시작 구간 vs 종료 구간
                        </p>
                        <div className="space-y-2">
                          {session.aiAnalysis.llm.earlyCompetencyAssessments.map((early) => {
                            const late = session.aiAnalysis!.llm.lateCompetencyAssessments.find(
                              (x) => x.subScale === early.subScale
                            );
                            const bothHaveEvidence = early.confidence !== "none" && late && late.confidence !== "none";
                            if (early.confidence === "none" && (!late || late.confidence === "none")) return null;
                            const delta = bothHaveEvidence ? (late!.score - early.score) : null;
                            return (
                              <div key={early.subScale} className="rounded-lg border border-border p-2.5">
                                <div className="mb-1.5 flex items-center justify-between text-xs">
                                  <span className="text-white/85">{early.subScale}</span>
                                  {bothHaveEvidence ? (
                                    <Badge tone={delta! > 0 ? "positive" : delta! < 0 ? "negative" : "neutral"}>
                                      {early.score}점 → {late!.score}점 ({delta! > 0 ? "+" : ""}
                                      {delta})
                                    </Badge>
                                  ) : (
                                    <Badge tone="neutral">
                                      {early.confidence !== "none" ? `시작만 ${early.score}점` : `종료만 ${late?.score}점`}
                                    </Badge>
                                  )}
                                </div>
                                {early.confidence !== "none" && early.evidenceQuote && (
                                  <p className="text-xs text-muted">시작: &ldquo;{early.evidenceQuote}&rdquo;</p>
                                )}
                                {late && late.confidence !== "none" && late.evidenceQuote && (
                                  <p className="text-xs text-muted">종료: &ldquo;{late.evidenceQuote}&rdquo;</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </div>

      <SurveyDialog
        open={!!surveyTarget}
        type={surveyTarget?.type ?? "pre"}
        onClose={() => setSurveyTarget(null)}
        onSubmit={submitSurvey}
        submitting={submittingSurvey}
      />
    </div>
  );
}

function ParticipantRow({
  participant,
  active,
  sessionCount,
  onClick,
  onDelete,
}: {
  participant: OfflineParticipant;
  active: boolean;
  sessionCount: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0",
        active ? "bg-white/8" : "hover:bg-white/5"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted">
        <UserRound size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm text-white/90">{participant.name}</p>
          {participant.source === "online" && <Badge tone="accent">온라인 자동 등록</Badge>}
        </div>
        <p className="text-[11px] text-muted">
          {genderLabels[participant.gender]} · {participant.age}세 · 코칭 {sessionCount}회
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="rounded-lg p-1.5 text-muted hover:bg-negative/15 hover:text-negative"
        aria-label="참가자 삭제"
        title="참가자 삭제"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
