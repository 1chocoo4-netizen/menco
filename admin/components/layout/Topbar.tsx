"use client";

import { Search, Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";

export function Topbar({ title, description }: { title: string; description?: string }) {
  const [spinning, setSpinning] = useState(false);

  const refresh = () => {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-bg/80 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
            <Search size={15} className="text-muted" />
            <input
              placeholder="세션 ID, 익명 ID 검색"
              className="w-40 bg-transparent text-sm text-white placeholder:text-muted focus:outline-none sm:w-56"
            />
          </div>

          <button className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white/80 hover:bg-surface-hover">
            <Calendar size={15} className="text-muted" />
            2026-08-01 ~ 2026-08-28
          </button>

          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-white/80 hover:bg-surface-hover"
          >
            <RefreshCw size={15} className={spinning ? "animate-spin text-accent" : "text-muted"} />
            최신화
          </button>
        </div>
      </div>
    </div>
  );
}
