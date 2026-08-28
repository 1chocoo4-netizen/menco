"use client";

import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AgeBarChart } from "@/components/charts/AgeBarChart";
import { GenderDonutChart } from "@/components/charts/GenderDonutChart";
import { CompetencyRadarChart } from "@/components/charts/CompetencyRadarChart";
import {
  ageDistribution,
  competencyByCategory,
  competencyBySubScale,
  competencyRecords,
  genderDistribution,
  genderLabels,
  users,
  type AgeGroup,
  type CompetencyRecord,
  type DemographicRecord,
  type Gender,
} from "@/lib/mock-data";
import { ageToGroup, offlineCompetencyRecords, offlineDemographicRecords } from "@/lib/offline-aggregate";
import type { OfflineData } from "@/lib/offline-store";
import { cn } from "@/lib/utils";

const AGE_GROUPS: (AgeGroup | "전체")[] = ["전체", "10대 이하", "10대", "20대", "30대", "40대 이상"];
const GENDERS: (Gender | "전체")[] = ["전체", "female", "male", "unspecified"];

interface CombinedUserRow {
  id: string;
  gender: Gender;
  ageGroup: AgeGroup;
  sessions: number;
  joinedAt: string;
  source: "온라인" | "오프라인";
}

export default function MentalCompetencyPage() {
  const [genderFilter, setGenderFilter] = useState<Gender | "전체">("전체");
  const [ageFilter, setAgeFilter] = useState<AgeGroup | "전체">("전체");
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);

  useEffect(() => {
    fetch("/api/offline/data")
      .then((r) => r.json())
      .then((d: OfflineData) => setOfflineData(d));
  }, []);

  const filter = {
    gender: genderFilter === "전체" ? undefined : genderFilter,
    ageGroup: ageFilter === "전체" ? undefined : ageFilter,
  };

  const combinedRows: CombinedUserRow[] = useMemo(() => {
    const online: CombinedUserRow[] = users.map((u) => ({ ...u, source: "온라인" }));
    const offline: CombinedUserRow[] =
      offlineData?.participants.map((p) => ({
        id: p.id,
        gender: p.gender,
        ageGroup: ageToGroup(p.age),
        sessions: offlineData.sessions.filter((s) => s.participantId === p.id).length,
        joinedAt: p.createdAt.slice(0, 10),
        source: p.source === "online" ? "온라인" : "오프라인",
      })) ?? [];
    return [...online, ...offline];
  }, [offlineData]);

  const combinedDemographics: DemographicRecord[] = useMemo(
    () => [...users, ...(offlineData ? offlineDemographicRecords(offlineData) : [])],
    [offlineData]
  );

  const combinedCompetencyRecords: CompetencyRecord[] = useMemo(
    () => [...competencyRecords, ...(offlineData ? offlineCompetencyRecords(offlineData) : [])],
    [offlineData]
  );

  const filtered = useMemo(
    () =>
      combinedRows.filter(
        (u) =>
          (genderFilter === "전체" || u.gender === genderFilter) &&
          (ageFilter === "전체" || u.ageGroup === ageFilter)
      ),
    [combinedRows, genderFilter, ageFilter]
  );

  const ageChartData = useMemo(
    () => ageDistribution({ gender: filter.gender }, combinedDemographics),
    [filter.gender, combinedDemographics]
  );
  const genderChartData = useMemo(
    () => genderDistribution({ ageGroup: filter.ageGroup }, combinedDemographics),
    [filter.ageGroup, combinedDemographics]
  );
  const subScaleData = useMemo(
    () => competencyBySubScale(filter, combinedCompetencyRecords),
    [filter.gender, filter.ageGroup, combinedCompetencyRecords]
  );
  const categoryData = useMemo(
    () => competencyByCategory(filter, combinedCompetencyRecords),
    [filter.gender, filter.ageGroup, combinedCompetencyRecords]
  );

  const filterLabel =
    genderFilter === "전체" && ageFilter === "전체"
      ? "전체 사용자"
      : [ageFilter !== "전체" ? ageFilter : null, genderFilter !== "전체" ? genderLabels[genderFilter] : null]
          .filter(Boolean)
          .join(" · ");

  return (
    <div>
      <Topbar title="멘탈 역량 분석" description="인구통계 분포 + 코칭 전/후 멘탈력(4C) 변화 비교" />

      <div className="px-4 pt-6 md:px-8">
        <Card>
          <CardHeader>
            <CardTitle>필터</CardTitle>
          </CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <div>
              <p className="mb-2 text-xs text-muted">성별</p>
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      genderFilter === g
                        ? "border-transparent bg-gradient-to-br from-accent to-accent2 text-white font-medium"
                        : "border-border bg-transparent text-white/70 hover:bg-white/5"
                    )}
                  >
                    {g === "전체" ? "전체" : genderLabels[g]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-muted">연령대</p>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAgeFilter(a)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      ageFilter === a
                        ? "border-transparent bg-gradient-to-br from-accent to-accent2 text-white font-medium"
                        : "border-border bg-transparent text-white/70 hover:bg-white/5"
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:ml-auto">
              <Badge tone="accent">조건 일치 {filtered.length}명</Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 py-6 md:px-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>연령대별 분포</CardTitle>
              <CardDescription>{genderFilter === "전체" ? "전체 성별" : genderLabels[genderFilter]} 기준</CardDescription>
            </div>
          </CardHeader>
          <AgeBarChart data={ageChartData} />
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>성별 비율</CardTitle>
              <CardDescription>{ageFilter === "전체" ? "전체 연령대" : `${ageFilter} 기준`}</CardDescription>
            </div>
          </CardHeader>
          <GenderDonutChart data={genderChartData} />
        </Card>
      </div>

      <div className="px-4 md:px-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white/90">멘탈력 변화 · {filterLabel}</h2>
          <Badge tone="neutral">코칭 전(Pre) → 코칭 후(Post)</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 pb-6 md:px-8 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>하위 8개 역량 · 사전(Pre) vs 사후(Post)</CardTitle>
              <CardDescription>1~10점 척도 평균값 · {filterLabel} 기준</CardDescription>
            </div>
          </CardHeader>
          <CompetencyRadarChart items={subScaleData} />
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>4C 카테고리별 평균 변화</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {categoryData.map((c) => {
              const delta = c.post - c.pre;
              return (
                <div key={c.category}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-white/85">{c.category}</span>
                    <Badge tone={delta > 0 ? "positive" : "neutral"}>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent2"
                      style={{ width: `${(c.post / 10) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted">
                    <span>사전 {c.pre.toFixed(2)}</span>
                    <span>사후 {c.post.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="px-4 pb-8 md:px-8">
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-5 py-3 font-medium">4C 카테고리</th>
                  <th className="px-5 py-3 font-medium">하위 역량</th>
                  <th className="px-5 py-3 font-medium">사전(Pre)</th>
                  <th className="px-5 py-3 font-medium">사후(Post)</th>
                  <th className="px-5 py-3 font-medium">변화량</th>
                  <th className="px-5 py-3 font-medium">응답 수</th>
                </tr>
              </thead>
              <tbody>
                {subScaleData.every((s) => s.n === 0) && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted">
                      해당 조건의 사전/사후 설문 응답이 아직 없습니다.
                    </td>
                  </tr>
                )}
                {subScaleData.map((item) => (
                  <tr key={item.subScale} className="border-b border-border/60 text-white/85 last:border-0">
                    <td className="px-5 py-3 text-muted">{item.category}</td>
                    <td className="px-5 py-3">{item.subScale}</td>
                    <td className="px-5 py-3">{item.pre.toFixed(1)}</td>
                    <td className="px-5 py-3">{item.post.toFixed(1)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={item.post - item.pre > 0 ? "positive" : "neutral"}>
                        {item.post - item.pre > 0 ? "+" : ""}
                        {(item.post - item.pre).toFixed(1)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted">{item.n}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="px-4 pb-8 md:px-8">
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-5 py-3 font-medium">익명 ID</th>
                  <th className="px-5 py-3 font-medium">출처</th>
                  <th className="px-5 py-3 font-medium">성별</th>
                  <th className="px-5 py-3 font-medium">연령대</th>
                  <th className="px-5 py-3 font-medium">참여 세션 수</th>
                  <th className="px-5 py-3 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted">
                      아직 등록된 사용자가 없습니다.
                    </td>
                  </tr>
                )}
                {filtered.slice(0, 20).map((u) => (
                  <tr key={u.id} className="border-b border-border/60 text-white/85 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs text-accent">{u.id}</td>
                    <td className="px-5 py-3">
                      <Badge tone={u.source === "오프라인" ? "accent" : "neutral"}>{u.source}</Badge>
                    </td>
                    <td className="px-5 py-3">{genderLabels[u.gender]}</td>
                    <td className="px-5 py-3">{u.ageGroup}</td>
                    <td className="px-5 py-3">{u.sessions}회</td>
                    <td className="px-5 py-3 text-muted">{u.joinedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 20 && (
            <p className="px-5 py-3 text-xs text-muted">외 {filtered.length - 20}명 더 있음</p>
          )}
        </Card>
      </div>
    </div>
  );
}
