import { Sparkles } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">MENCO Admin</p>
        </div>
      </div>

      <div className="border-t border-border px-5 py-4 text-[11px] text-muted mt-auto">
        숭실대학교 커리어학습코칭 연구소
      </div>
    </aside>
  );
}
