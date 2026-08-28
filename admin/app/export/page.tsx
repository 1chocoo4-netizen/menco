"use client";

import { Topbar } from "@/components/layout/Topbar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { exportColumns, exportRows } from "@/lib/mock-data";
import { Download, FileSpreadsheet } from "lucide-react";

function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

export default function ExportPage() {
  const rows = exportRows();
  const hasRows = rows.length > 0;

  const download = () => {
    const csv = "﻿" + toCsv(rows); // BOM for Excel 한글 깨짐 방지
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menco_research_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Topbar title="데이터 Export" description="SPSS · R · Python 분석용 익명화 데이터 다운로드" />

      <div className="px-4 py-6 md:px-8">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>세션 요약 데이터셋</CardTitle>
              <CardDescription>
                익명 ID 기준으로 개인 식별 정보 없이 세션별 요약 지표만 포함됩니다. ({rows.length}행)
              </CardDescription>
            </div>
            <Button onClick={download} disabled={!hasRows}>
              <Download size={15} />
              CSV 다운로드
            </Button>
          </CardHeader>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  {exportColumns.map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hasRows ? (
                  rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-border/60 text-white/80 last:border-0">
                      {exportColumns.map((h) => (
                        <td key={h} className="whitespace-nowrap px-4 py-2.5">
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={exportColumns.length} className="px-4 py-8 text-center text-muted">
                      아직 내보낼 세션 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <FileSpreadsheet size={13} />
            {hasRows
              ? `미리보기는 상위 10행만 표시됩니다. 다운로드 시 전체 ${rows.length}행이 포함됩니다.`
              : "세션 데이터가 쌓이면 이 표와 CSV 다운로드가 자동으로 채워집니다."}
          </p>
        </Card>
      </div>
    </div>
  );
}
