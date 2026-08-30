"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Activity, FileSearch, Download, Sparkles, ClipboardList, Ticket } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "대시보드 요약", icon: LayoutDashboard },
  { href: "/mental-competency", label: "멘탈 역량 분석", icon: Activity },
  { href: "/evidence", label: "대화 근거/원문 데이터베이스", icon: FileSearch },
  { href: "/offline-research", label: "오프라인 연구 데이터", icon: ClipboardList },
  { href: "/coupons", label: "쿠폰", icon: Ticket },
  { href: "/export", label: "데이터 Export", icon: Download },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">MENCO Admin</p>
          <p className="text-[11px] leading-tight text-muted">학술 연구 데이터 관리</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-white/8 text-white font-medium"
                  : "text-muted hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4 text-[11px] text-muted">
        숭실대학교 커리어학습코칭 연구소
        <br />
        멘탈력 효과 검증 연구
      </div>
    </aside>
  );
}
