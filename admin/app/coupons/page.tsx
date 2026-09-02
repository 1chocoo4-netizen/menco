"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Ban, Copy, Plus, RotateCcw, Ticket, Trash2 } from "lucide-react";
import type { Coupon } from "@/lib/coupon-store";

function isExpired(coupon: Coupon) {
  return !!coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now();
}

function isExhausted(coupon: Coupon) {
  return coupon.usedCount >= coupon.maxUses;
}

function statusOf(coupon: Coupon): { label: string; tone: "positive" | "negative" | "neutral" } {
  if (coupon.status === "revoked") return { label: "비활성화", tone: "negative" };
  if (isExpired(coupon)) return { label: "기간 만료", tone: "negative" };
  if (isExhausted(coupon)) return { label: "소진", tone: "neutral" };
  return { label: "사용 가능", tone: "positive" };
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("1000");
  const [quantity, setQuantity] = useState("1");
  const [customCode, setCustomCode] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coupons")
      .then((r) => r.json())
      .then((d: Coupon[]) => setCoupons(d));
  }, []);

  const list = useMemo(
    () => [...(coupons ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [coupons]
  );

  async function issue() {
    const maxUsesNum = Number(maxUses);
    const quantityNum = customCode.trim() ? 1 : Number(quantity);
    if (!Number.isFinite(maxUsesNum) || maxUsesNum < 1) return;
    if (!Number.isFinite(quantityNum) || quantityNum < 1) return;

    setIssuing(true);
    setIssueError("");
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          expiresAt: expiresAt || null,
          maxUses: maxUsesNum,
          quantity: quantityNum,
          code: customCode.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setIssueError(d.error || "쿠폰 발급에 실패했습니다.");
        return;
      }
      setCoupons(d);
      setDescription("");
      setExpiresAt("");
      setMaxUses("1000");
      setQuantity("1");
      setCustomCode("");
    } finally {
      setIssuing(false);
    }
  }

  async function toggleStatus(coupon: Coupon) {
    const nextStatus = coupon.status === "active" ? "revoked" : "active";
    const res = await fetch(`/api/coupons/${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const d = await res.json();
    setCoupons(d);
  }

  async function remove(coupon: Coupon) {
    if (!window.confirm(`쿠폰 "${coupon.code}"를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/coupons/${coupon.id}`, { method: "DELETE" });
    const d = await res.json();
    setCoupons(d);
  }

  async function copyCode(coupon: Coupon) {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopiedId(coupon.id);
      setTimeout(() => setCopiedId((prev) => (prev === coupon.id ? null : prev)), 1500);
    } catch {
      // 클립보드 접근이 막힌 환경(비-HTTPS 등)에서는 조용히 무시한다.
    }
  }

  return (
    <div>
      <Topbar title="쿠폰" description="이용 쿠폰을 발급하고 발급 현황을 관리합니다" />

      <div className="grid grid-cols-1 gap-4 p-4 md:p-8 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>쿠폰 발급</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">설명 (메모)</p>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="예: 8월 이벤트 무료 체험"
                className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">만료일 (선택)</p>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent [color-scheme:dark]"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">코드 직접 지정 (선택)</p>
              <input
                value={customCode}
                onChange={(e) => {
                  setIssueError("");
                  setCustomCode(e.target.value);
                }}
                placeholder="예: 서초중학교 (비워두면 자동 생성됩니다)"
                maxLength={40}
                className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
              />
              <p className="mt-1 text-[11px] text-muted">원하는 글자를 자유롭게 입력하세요. 직접 지정 시 1개만 발급됩니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">1개당 사용 횟수</p>
                <input
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">발급 매수</p>
                <input
                  value={customCode.trim() ? "1" : quantity}
                  onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={!!customCode.trim()}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-border bg-bg/40 px-3 py-2 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>
            </div>
            {issueError && <p className="text-xs text-negative">{issueError}</p>}
            <Button className="w-full justify-center" disabled={issuing} onClick={issue}>
              <Plus size={15} />
              {issuing ? "발급 중..." : "쿠폰 발급"}
            </Button>
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <Ticket size={16} className="text-accent" />
              <p className="text-sm font-semibold text-white/90">발급된 쿠폰</p>
            </div>
            <span className="text-xs text-muted">총 {list.length}개</span>
          </div>

          {list.length === 0 && (
            <p className="p-8 text-center text-sm text-muted">아직 발급된 쿠폰이 없습니다.</p>
          )}

          {list.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="px-5 py-2.5 font-medium">코드</th>
                    <th className="px-5 py-2.5 font-medium">설명</th>
                    <th className="px-5 py-2.5 font-medium">사용</th>
                    <th className="px-5 py-2.5 font-medium">만료일</th>
                    <th className="px-5 py-2.5 font-medium">상태</th>
                    <th className="px-5 py-2.5 font-medium">발급일</th>
                    <th className="px-5 py-2.5 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((coupon) => {
                    const status = statusOf(coupon);
                    return (
                      <tr key={coupon.id} className="border-b border-border/60 last:border-0">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <code className="rounded bg-white/5 px-2 py-1 text-xs text-white/90">
                              {coupon.code}
                            </code>
                            <button
                              onClick={() => copyCode(coupon)}
                              className="rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-white"
                              title="코드 복사"
                              aria-label="코드 복사"
                            >
                              <Copy size={13} />
                            </button>
                            {copiedId === coupon.id && <span className="text-[11px] text-accent">복사됨</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-white/80">{coupon.description || "-"}</td>
                        <td className="px-5 py-3 text-white/80">
                          {coupon.usedCount} / {coupon.maxUses}
                        </td>
                        <td className="px-5 py-3 text-white/80">{coupon.expiresAt ?? "무제한"}</td>
                        <td className="px-5 py-3">
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted">
                          {coupon.createdAt.slice(0, 10)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleStatus(coupon)}
                              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                              title={coupon.status === "active" ? "비활성화" : "다시 활성화"}
                              aria-label={coupon.status === "active" ? "비활성화" : "다시 활성화"}
                            >
                              {coupon.status === "active" ? <Ban size={14} /> : <RotateCcw size={14} />}
                              {coupon.status === "active" ? "비활성화" : "재활성화"}
                            </button>
                            <button
                              onClick={() => remove(coupon)}
                              className="flex items-center gap-1 rounded-lg border border-negative/40 bg-negative/10 px-2 py-1.5 text-xs text-negative hover:bg-negative/20"
                              title="삭제"
                              aria-label="삭제"
                            >
                              <Trash2 size={14} />
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
