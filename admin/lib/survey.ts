// 코칭 전/후 멘탈력 자기보고식 설문 (20문항, 5점 리커트).
//
// ⚠️ 중요: 아래 문항은 4C(도전/전념/조절/자신감) 및 8개 하위역량 "구성개념 정의"에 맞춰
// 새로 작성한 문항이며, 상표권/저작권이 있는 실제 MTQ48 검사 문항을 그대로 옮긴 것이 아니다.
// 정식 학술 논문에 "MTQ48 검사를 사용했다"고 기술하려면 AQR International의 정식 라이선스를
// 받아 그 문항을 사용해야 한다. 라이선스 없이 게재하려면, 본 문항 세트를 별도로 신뢰도
// (Cronbach's α)·타당도 검증을 거친 "자체 개발 척도"로 명시해 사용하는 것이 안전하다.

export type CompetencyCategory = "도전" | "전념" | "조절" | "자신감";

export interface SurveyItem {
  id: number;
  category: CompetencyCategory;
  subScale: string;
  text: string;
  /** 역채점 문항이면 true (점수 = 6 - 응답값) */
  reverse: boolean;
}

export const SURVEY_ITEMS: SurveyItem[] = [
  { id: 1, category: "도전", subScale: "위험 감수", text: "나는 실패할 위험이 있더라도 새로운 도전을 시도하는 편이다.", reverse: false },
  { id: 2, category: "도전", subScale: "위험 감수", text: "나는 익숙하지 않은 상황에 뛰어드는 것을 주저하지 않는다.", reverse: false },
  { id: 3, category: "도전", subScale: "위험 감수", text: "나는 확실한 결과가 보장되지 않으면 시도하지 않는 편이다.", reverse: true },
  { id: 4, category: "도전", subScale: "학습 지향", text: "나는 실수를 통해 배우는 것을 중요하게 생각한다.", reverse: false },
  { id: 5, category: "도전", subScale: "학습 지향", text: "나는 어려운 과제를 통해 성장할 수 있다고 믿는다.", reverse: false },
  { id: 6, category: "전념", subScale: "목표 지향", text: "나는 목표를 세우면 끝까지 이루려고 노력한다.", reverse: false },
  { id: 7, category: "전념", subScale: "목표 지향", text: "나는 명확한 목표가 있을 때 더 힘을 낸다.", reverse: false },
  { id: 8, category: "전념", subScale: "목표 지향", text: "나는 목표를 세워도 중간에 흐지부지되는 경우가 많다.", reverse: true },
  { id: 9, category: "전념", subScale: "성취 지향", text: "나는 맡은 일을 완수했을 때 큰 만족감을 느낀다.", reverse: false },
  { id: 10, category: "전념", subScale: "성취 지향", text: "나는 스스로 정한 기준에 도달하기 위해 꾸준히 노력한다.", reverse: false },
  { id: 11, category: "조절", subScale: "정서 조절", text: "나는 스트레스 상황에서도 감정을 비교적 잘 다스리는 편이다.", reverse: false },
  { id: 12, category: "조절", subScale: "정서 조절", text: "나는 화가 나는 상황에서도 침착함을 유지하려고 노력한다.", reverse: false },
  { id: 13, category: "조절", subScale: "정서 조절", text: "나는 부정적인 감정에 쉽게 휩쓸리는 편이다.", reverse: true },
  { id: 14, category: "조절", subScale: "삶의 통제", text: "나는 내 삶의 중요한 부분들을 스스로 통제하고 있다고 느낀다.", reverse: false },
  { id: 15, category: "조절", subScale: "삶의 통제", text: "나는 예상치 못한 일이 생겨도 상황을 조절할 수 있다고 믿는다.", reverse: false },
  { id: 16, category: "자신감", subScale: "능력 자신감", text: "나는 어려운 문제도 결국 해결할 수 있다고 믿는다.", reverse: false },
  { id: 17, category: "자신감", subScale: "능력 자신감", text: "나는 내 능력에 대해 자신감을 가지고 있다.", reverse: false },
  { id: 18, category: "자신감", subScale: "능력 자신감", text: "나는 새로운 과제를 맡으면 내가 잘 해낼 수 있을지 자주 의심한다.", reverse: true },
  { id: 19, category: "자신감", subScale: "대인관계 자신감", text: "나는 다른 사람들 앞에서 내 의견을 자신 있게 말할 수 있다.", reverse: false },
  { id: 20, category: "자신감", subScale: "대인관계 자신감", text: "나는 낯선 사람과도 편안하게 관계를 맺을 수 있다.", reverse: false },
];

export const LIKERT_LABELS = ["전혀 그렇지 않다", "그렇지 않다", "보통이다", "그렇다", "매우 그렇다"];

export interface SurveyScoreResult {
  subScaleScores: { category: CompetencyCategory; subScale: string; score: number }[];
  categoryScores: { category: CompetencyCategory; score: number }[];
  overall: number;
}

/** answers: 문항 id(1~20) -> 원점수(1~5) */
export function scoreSurvey(answers: Record<number, number>): SurveyScoreResult {
  const bySubScale = new Map<string, { category: CompetencyCategory; values: number[] }>();

  for (const item of SURVEY_ITEMS) {
    const raw = answers[item.id];
    if (raw === undefined) continue;
    const score = item.reverse ? 6 - raw : raw;
    const key = item.subScale;
    const cur = bySubScale.get(key) ?? { category: item.category, values: [] };
    cur.values.push(score);
    bySubScale.set(key, cur);
  }

  const subScaleScores = Array.from(bySubScale.entries()).map(([subScale, v]) => ({
    category: v.category,
    subScale,
    // 1~5점 문항 평균을 1~10점 척도로 환산 (대시보드 척도와 통일)
    score: Number((((v.values.reduce((s, x) => s + x, 0) / v.values.length) - 1) * (9 / 4) + 1).toFixed(2)),
  }));

  const byCategory = new Map<CompetencyCategory, number[]>();
  for (const s of subScaleScores) {
    const arr = byCategory.get(s.category) ?? [];
    arr.push(s.score);
    byCategory.set(s.category, arr);
  }
  const categoryScores = Array.from(byCategory.entries()).map(([category, values]) => ({
    category,
    score: Number((values.reduce((s, x) => s + x, 0) / values.length).toFixed(2)),
  }));

  const overall = Number(
    (categoryScores.reduce((s, c) => s + c.score, 0) / (categoryScores.length || 1)).toFixed(2)
  );

  return { subScaleScores, categoryScores, overall };
}
