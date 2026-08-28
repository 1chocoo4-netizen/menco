import { Topbar } from "@/components/layout/Topbar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GenderDonutChart } from "@/components/charts/GenderDonutChart";
import { AgeBarChart } from "@/components/charts/AgeBarChart";
import {
  ageDistribution,
  competencyByCategory,
  genderDistribution,
  interRaterSamples,
  sessionEvidences,
  totalSessions,
  users,
} from "@/lib/mock-data";
import { computeReliabilityReport, interpretKappa } from "@/lib/reliability";
import { Users, MessagesSquare, TrendingUp, Clock, ShieldCheck } from "lucide-react";

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs text-muted">{hint}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-accent">
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

export default function OverviewPage() {
  const categoryData = competencyByCategory();
  const avgPostImprovement =
    categoryData.length > 0
      ? categoryData.reduce((sum, c) => sum + (c.post - c.pre), 0) / categoryData.length
      : 0;
  const reliability = computeReliabilityReport(interRaterSamples, sessionEvidences.length);

  return (
    <div>
      <Topbar title="대시보드 요약" description="전체 누적 사용자 · 세션 · 인구통계 스냅샷" />

      <div className="grid grid-cols-1 gap-4 px-4 py-6 sm:grid-cols-2 md:px-8 xl:grid-cols-4">
        <KpiCard icon={Users} label="누적 사용자 수" value={`${users.length.toLocaleString()}명`} hint="DB 연동 전 · 아직 데이터 없음" />
        <KpiCard icon={MessagesSquare} label="누적 대화 세션 수" value={`${totalSessions.toLocaleString()}회`} hint={`분석 완료 ${sessionEvidences.length}건`} />
        <KpiCard icon={Clock} label="평균 세션 길이" value="- 분" hint="세션 데이터 수집 후 계산" />
        <KpiCard icon={TrendingUp} label="멘탈력 평균 향상폭" value={`+${avgPostImprovement.toFixed(2)}점`} hint="4C 8개 하위역량 평균" />
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 pb-8 md:px-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>성별 비율</CardTitle>
              <CardDescription>전체 등록 사용자 기준</CardDescription>
            </div>
          </CardHeader>
          <GenderDonutChart data={genderDistribution()} />
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>연령대별 분포</CardTitle>
              <CardDescription>전체 등록 사용자 기준</CardDescription>
            </div>
          </CardHeader>
          <AgeBarChart data={ageDistribution()} />
        </Card>
      </div>

      <div className="px-4 pb-8 md:px-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-accent" />
              <div>
                <CardTitle>연구 방법론 · 신뢰도 검증</CardTitle>
                <CardDescription>학술 게재를 위한 코딩 신뢰도 및 감성분석 기준</CardDescription>
              </div>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-white/85">① AI-인간 코더 간 신뢰도</p>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                전체 분석 세션의 10~20%를 무작위 추출해 연구자(멘탈코칭 전문가 2인)가 별도로
                수동 코딩하고, AI 1차 코딩 결과와 비교해 Cohen&apos;s Kappa로 일치도를 산출합니다.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={reliability.kappaAiVsHuman1 !== null ? "positive" : "neutral"}>
                  κ (AI vs 인간1) ={" "}
                  {reliability.kappaAiVsHuman1 !== null ? reliability.kappaAiVsHuman1.toFixed(2) : "데이터 없음"}
                </Badge>
                <Badge tone="neutral">
                  표본 {reliability.sampleSize}건 / 전체 {reliability.totalItems}건 ({reliability.samplingRatioPct}%)
                </Badge>
              </div>
              {reliability.kappaAiVsHuman1 !== null && (
                <p className="mt-2 text-xs text-muted">해석: {interpretKappa(reliability.kappaAiVsHuman1)}</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-white/85">② 감성 어휘 판별 기준</p>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                긍정/부정 단어 비율의 최종 수치는 LLM의 자유 판단이 아니라, 표준 어휘사전(KNU
                한국어 감성사전 기준) 매칭으로 결정론적으로 계산합니다. LLM은 원문에 실제로
                등장하는 감정 표현 후보만 추출하며, TF-IDF 기반 핵심 키워드 추출을 교차 검증
                용도로 병행합니다.
              </p>
              <Badge tone="accent">lib/lexicon.ts · lib/gemini-analysis.ts 참고</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
