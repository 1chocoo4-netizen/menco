// 실제 서비스 연동 전 빈 상태(empty state) 데이터 정의.
// 여기 정의된 타입/함수 시그니처를 유지한 채, 실제 서비스에서는 Supabase 등 DB 조회로 교체한다.

export type Gender = "female" | "male" | "unspecified";
export type AgeGroup = "10대 이하" | "10대" | "20대" | "30대" | "40대 이상";

export interface UserRecord {
  id: string;
  gender: Gender;
  ageGroup: AgeGroup;
  sessions: number;
  joinedAt: string;
}

const AGE_GROUPS: AgeGroup[] = ["10대 이하", "10대", "20대", "30대", "40대 이상"];

export const users: UserRecord[] = [];

export const totalSessions = 0;

export const genderLabels: Record<Gender, string> = {
  female: "여성",
  male: "남성",
  unspecified: "기타/응답 안 함",
};

export interface DemographicFilter {
  gender?: Gender;
  ageGroup?: AgeGroup;
}

export interface DemographicRecord {
  gender: Gender;
  ageGroup: AgeGroup;
}

export function genderDistribution(
  filter?: Pick<DemographicFilter, "ageGroup">,
  records: DemographicRecord[] = users
) {
  const counts: Record<Gender, number> = { female: 0, male: 0, unspecified: 0 };
  for (const u of records) {
    if (filter?.ageGroup && u.ageGroup !== filter.ageGroup) continue;
    counts[u.gender]++;
  }
  return (Object.keys(counts) as Gender[]).map((g) => ({
    name: genderLabels[g],
    key: g,
    value: counts[g],
  }));
}

export function ageDistribution(
  filter?: Pick<DemographicFilter, "gender">,
  records: DemographicRecord[] = users
) {
  const counts: Record<AgeGroup, number> = {
    "10대 이하": 0,
    "10대": 0,
    "20대": 0,
    "30대": 0,
    "40대 이상": 0,
  };
  for (const u of records) {
    if (filter?.gender && u.gender !== filter.gender) continue;
    counts[u.ageGroup]++;
  }
  return AGE_GROUPS.map((g) => ({ name: g, value: counts[g] }));
}

// ── 멘탈력 4C 역량 사전/사후 점수 ─────────────────────────────────────────
// (도전/전념/조절/자신감 4C 모델 기반 8개 하위 역량. 척도 검사명은 노출하지 않는다.)
export type CompetencyCategory = "도전" | "전념" | "조절" | "자신감";

export interface CompetencySubScale {
  category: CompetencyCategory;
  subScale: string;
}

export const competencySubScales: CompetencySubScale[] = [
  { category: "도전", subScale: "위험 감수" },
  { category: "도전", subScale: "학습 지향" },
  { category: "전념", subScale: "목표 지향" },
  { category: "전념", subScale: "성취 지향" },
  { category: "조절", subScale: "정서 조절" },
  { category: "조절", subScale: "삶의 통제" },
  { category: "자신감", subScale: "능력 자신감" },
  { category: "자신감", subScale: "대인관계 자신감" },
];

export interface CompetencyRecord {
  userId: string;
  gender: Gender;
  ageGroup: AgeGroup;
  subScale: string;
  pre: number;
  post: number;
}

// 코칭 전/후 설문 응답이 쌓이는 원자료. 실제 서비스에서는 사용자별 사전/사후 응답으로 채워진다.
export const competencyRecords: CompetencyRecord[] = [];

function matchesFilter(r: { gender: Gender; ageGroup: AgeGroup }, filter?: DemographicFilter) {
  return (
    (!filter?.gender || r.gender === filter.gender) &&
    (!filter?.ageGroup || r.ageGroup === filter.ageGroup)
  );
}

export interface CompetencyAverage {
  category: CompetencyCategory;
  subScale: string;
  pre: number;
  post: number;
  n: number;
}

export function competencyBySubScale(
  filter?: DemographicFilter,
  records: CompetencyRecord[] = competencyRecords
): CompetencyAverage[] {
  return competencySubScales.map(({ category, subScale }) => {
    const matched = records.filter((r) => r.subScale === subScale && matchesFilter(r, filter));
    const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
    return {
      category,
      subScale,
      pre: Number(avg(matched.map((r) => r.pre)).toFixed(2)),
      post: Number(avg(matched.map((r) => r.post)).toFixed(2)),
      n: matched.length,
    };
  });
}

export function competencyByCategory(filter?: DemographicFilter, records: CompetencyRecord[] = competencyRecords) {
  const items = competencyBySubScale(filter, records);
  const map = new Map<CompetencyCategory, { category: CompetencyCategory; pre: number; post: number; n: number }>();
  for (const item of items) {
    const cur = map.get(item.category) ?? { category: item.category, pre: 0, post: 0, n: 0 };
    cur.pre += item.pre;
    cur.post += item.post;
    cur.n += 1;
    map.set(item.category, cur);
  }
  return Array.from(map.values()).map((c) => ({
    category: c.category,
    pre: Number((c.pre / c.n).toFixed(2)),
    post: Number((c.post / c.n).toFixed(2)),
  }));
}

// ── 대화 근거/원문 데이터베이스 ─────────────────────────────────────────
export interface EvidenceQuote {
  stage: "초반" | "후반";
  timestamp: string;
  text: string;
  tag: "부정" | "긍정" | "중립";
}

export interface SessionEvidence {
  id: string;
  userId: string;
  date: string;
  ageGroup: AgeGroup;
  gender: Gender;
  durationMin: number;
  negativeRatioStart: number;
  negativeRatioEnd: number;
  positiveRatioStart: number;
  positiveRatioEnd: number;
  keywords: string[];
  quotes: EvidenceQuote[];
}

export const sessionEvidences: SessionEvidence[] = [];

// ── 신뢰도 검증(Inter-rater Reliability) 표본 ──────────────────────────────
// 전체 세션의 10~20%를 무작위 추출해 AI 코딩과 인간 평정자(연구자/전문가) 코딩을 비교한다.
// 실제 연구 진행 전까지는 빈 배열로 둔다.
export const interRaterSamples: import("./reliability").ReliabilitySample[] = [];

// ── Export(CSV) 미리보기 ────────────────────────────────────────────────
export const exportColumns = [
  "anon_id",
  "session_id",
  "date",
  "age_group",
  "gender",
  "duration_min",
  "negative_ratio_start_pct",
  "negative_ratio_end_pct",
  "positive_ratio_start_pct",
  "positive_ratio_end_pct",
  "keywords",
] as const;

export function exportRows(): Record<string, string | number>[] {
  return sessionEvidences.map((s) => ({
    anon_id: s.userId,
    session_id: s.id,
    date: s.date,
    age_group: s.ageGroup,
    gender: genderLabels[s.gender],
    duration_min: s.durationMin,
    negative_ratio_start_pct: s.negativeRatioStart,
    negative_ratio_end_pct: s.negativeRatioEnd,
    positive_ratio_start_pct: s.positiveRatioStart,
    positive_ratio_end_pct: s.positiveRatioEnd,
    keywords: s.keywords.join("; "),
  }));
}
