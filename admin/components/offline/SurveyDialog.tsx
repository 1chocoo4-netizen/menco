"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LIKERT_LABELS, SURVEY_ITEMS } from "@/lib/survey";
import { cn } from "@/lib/utils";

export function SurveyDialog({
  open,
  type,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  type: "pre" | "post";
  onClose: () => void;
  onSubmit: (answers: Record<number, number>) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const answeredCount = Object.keys(answers).length;
  const complete = answeredCount === SURVEY_ITEMS.length;

  const grouped = useMemo(() => {
    const map = new Map<string, typeof SURVEY_ITEMS>();
    for (const item of SURVEY_ITEMS) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr as typeof SURVEY_ITEMS);
    }
    return Array.from(map.entries());
  }, []);

  const handleClose = () => {
    setAnswers({});
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={type === "pre" ? "코칭 전(Pre) 설문 — 멘탈력 자기보고" : "코칭 후(Post) 설문 — 멘탈력 자기보고"}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            각 문항에 대해 자신에게 해당하는 정도를 1(전혀 그렇지 않다) ~ 5(매우 그렇다)로 선택하세요.
          </p>
          <Badge tone={complete ? "positive" : "neutral"}>
            {answeredCount}/{SURVEY_ITEMS.length} 완료
          </Badge>
        </div>

        {grouped.map(([category, items]) => (
          <div key={category}>
            <p className="mb-2 text-xs font-semibold text-accent">{category}</p>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-bg/40 p-3">
                  <p className="mb-2 text-sm text-white/85">
                    {item.id}. {item.text}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {LIKERT_LABELS.map((label, i) => {
                      const value = i + 1;
                      const selected = answers[item.id] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          title={label}
                          onClick={() => setAnswers((prev) => ({ ...prev, [item.id]: value }))}
                          className={cn(
                            "flex h-8 flex-1 items-center justify-center rounded-lg border text-xs transition-colors",
                            selected
                              ? "border-transparent bg-gradient-to-br from-accent to-accent2 text-white font-semibold"
                              : "border-border bg-transparent text-white/60 hover:bg-white/5"
                          )}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            취소
          </Button>
          <Button disabled={!complete || submitting} onClick={() => onSubmit(answers)}>
            {submitting ? "저장 중..." : "설문 저장"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
