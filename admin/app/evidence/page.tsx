"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { genderLabels, sessionEvidences, type SessionEvidence } from "@/lib/mock-data";
import { ChevronRight } from "lucide-react";

function SentimentBar({ label, start, end, tone }: { label: string; start: number; end: number; tone: "negative" | "positive" }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className={tone === "negative" ? "text-negative" : "text-positive"}>
          {start}% → {end}%
        </span>
      </div>
      <div className="flex h-2 gap-1">
        <div className="flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className={tone === "negative" ? "h-full bg-negative/70" : "h-full bg-positive/70"}
            style={{ width: `${start}%` }}
          />
        </div>
        <div className="flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className={tone === "negative" ? "h-full bg-negative/70" : "h-full bg-positive/70"}
            style={{ width: `${end}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function EvidencePage() {
  const [selected, setSelected] = useState<SessionEvidence | null>(null);

  return (
    <div>
      <Topbar title="대화 근거/원문 데이터베이스" description="분석 점수의 근거가 된 원문 인용구를 확인" />

      <div className="px-4 py-6 md:px-8">
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-5 py-3 font-medium">세션 ID</th>
                  <th className="px-5 py-3 font-medium">익명 ID</th>
                  <th className="px-5 py-3 font-medium">날짜</th>
                  <th className="px-5 py-3 font-medium">인구통계</th>
                  <th className="px-5 py-3 font-medium">부정어 비율 변화</th>
                  <th className="px-5 py-3 font-medium">키워드</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sessionEvidences.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-muted">
                      아직 분석된 대화 세션이 없습니다.
                    </td>
                  </tr>
                )}
                {sessionEvidences.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="cursor-pointer border-b border-border/60 text-white/85 transition-colors last:border-0 hover:bg-white/5"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-accent">{s.id}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">{s.userId}</td>
                    <td className="px-5 py-3 text-muted">{s.date}</td>
                    <td className="px-5 py-3">
                      {s.ageGroup} · {genderLabels[s.gender]}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone="positive">
                        {s.negativeRatioStart}% → {s.negativeRatioEnd}%
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.keywords.map((k) => (
                          <Badge key={k}>{k}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.id} · 근거 원문 보기` : ""}
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <SentimentBar
                label="부정어 비율 (초반 → 후반)"
                start={selected.negativeRatioStart}
                end={selected.negativeRatioEnd}
                tone="negative"
              />
              <SentimentBar
                label="긍정어 비율 (초반 → 후반)"
                start={selected.positiveRatioStart}
                end={selected.positiveRatioEnd}
                tone="positive"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">핵심 감정 키워드</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.keywords.map((k) => (
                  <Badge key={k} tone="accent">
                    {k}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted">원문 인용구 (Ground Truth)</p>
              <div className="space-y-2">
                {selected.quotes.map((q, i) => (
                  <div key={i} className="rounded-xl border border-border bg-bg/40 p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <Badge tone={q.stage === "초반" ? "negative" : "positive"}>{q.stage}</Badge>
                      <span className="font-mono text-[11px] text-muted">{q.timestamp}</span>
                      <Badge tone={q.tag === "부정" ? "negative" : q.tag === "긍정" ? "positive" : "neutral"}>
                        {q.tag}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/85">&ldquo;{q.text}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
