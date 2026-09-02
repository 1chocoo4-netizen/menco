"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkles, Ticket } from "lucide-react";

const NAV_ITEMS = [{ href: "/coupons", label: "쿠폰", icon: Ticket }];

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
          <p className="text-[11px] leading-tight text-muted">쿠폰 관리</p>
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
      </div>
    </aside>
  );
}
