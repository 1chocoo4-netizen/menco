// 연구 신뢰도 검증 유틸리티.
// AI 코딩 결과와 인간 평정자(연구자/멘탈코칭 전문가) 코딩 결과 간 일치도를 계산한다.
// 표본 설계: 전체 분석 대상 세션 중 10~20%를 무작위 추출해 2인 이상이 별도로 수동 코딩하고,
// 그 결과를 AI 코딩 결과와 비교해 아래 지표로 산출한다.

/** Cohen's Kappa — 두 평정자의 범주형 판단(예: 긍정/부정/중립) 일치도 */
export function cohensKappa(raterA: string[], raterB: string[]): number | null {
  if (raterA.length !== raterB.length || raterA.length === 0) return null;

  const n = raterA.length;
  const categories = Array.from(new Set([...raterA, ...raterB]));
  const countsA = new Map(categories.map((c) => [c, 0]));
  const countsB = new Map(categories.map((c) => [c, 0]));
  let agree = 0;

  for (let i = 0; i < n; i++) {
    if (raterA[i] === raterB[i]) agree++;
    countsA.set(raterA[i], (countsA.get(raterA[i]) ?? 0) + 1);
    countsB.set(raterB[i], (countsB.get(raterB[i]) ?? 0) + 1);
  }

  const observedAgreement = agree / n;
  const expectedAgreement = categories.reduce((sum, c) => {
    const pA = (countsA.get(c) ?? 0) / n;
    const pB = (countsB.get(c) ?? 0) / n;
    return sum + pA * pB;
  }, 0);

  if (expectedAgreement === 1) return 1;
  return (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
}

/** ICC(2,1) 근사치 — 두 평정자의 연속형 점수(예: 1~10점 역량 척도) 일치도 */
export function iccTwoWay(raterA: number[], raterB: number[]): number | null {
  if (raterA.length !== raterB.length || raterA.length < 2) return null;

  const n = raterA.length;
  const allScores = [...raterA, ...raterB];
  const grandMean = allScores.reduce((s, v) => s + v, 0) / allScores.length;

  let ssTotal = 0;
  for (const v of allScores) ssTotal += (v - grandMean) ** 2;

  let ssSubjects = 0;
  for (let i = 0; i < n; i++) {
    const subjectMean = (raterA[i] + raterB[i]) / 2;
    ssSubjects += 2 * (subjectMean - grandMean) ** 2;
  }

  let ssRaters = 0;
  const meanA = raterA.reduce((s, v) => s + v, 0) / n;
  const meanB = raterB.reduce((s, v) => s + v, 0) / n;
  ssRaters = n * ((meanA - grandMean) ** 2 + (meanB - grandMean) ** 2);

  const ssError = ssTotal - ssSubjects - ssRaters;
  const msSubjects = ssSubjects / (n - 1);
  const msError = ssError / (n - 1);

  if (msSubjects + msError === 0) return null;
  return (msSubjects - msError) / (msSubjects + msError);
}

/** Landis & Koch(1977) 해석 기준 */
export function interpretKappa(k: number): string {
  if (k < 0) return "일치 없음(Poor)";
  if (k <= 0.2) return "미미한 일치(Slight)";
  if (k <= 0.4) return "약한 일치(Fair)";
  if (k <= 0.6) return "보통 일치(Moderate)";
  if (k <= 0.8) return "상당한 일치(Substantial)";
  return "거의 완벽한 일치(Almost Perfect)";
}

export interface ReliabilitySample {
  itemId: string;
  aiLabel: string;
  humanLabelRater1: string;
  humanLabelRater2?: string;
}

export interface ReliabilityReport {
  sampleSize: number;
  totalItems: number;
  samplingRatioPct: number;
  kappaAiVsHuman1: number | null;
  kappaHuman1VsHuman2: number | null;
}

/**
 * 전체 항목 수(totalItems) 대비 표본(samples)의 신뢰도 리포트를 계산한다.
 * 표본이 없으면(연구 초기) null 지표와 함께 구조만 반환한다.
 */
export function computeReliabilityReport(
  samples: ReliabilitySample[],
  totalItems: number
): ReliabilityReport {
  const aiLabels = samples.map((s) => s.aiLabel);
  const human1Labels = samples.map((s) => s.humanLabelRater1);
  const human2Labels = samples
    .filter((s) => s.humanLabelRater2)
    .map((s) => s.humanLabelRater2 as string);

  return {
    sampleSize: samples.length,
    totalItems,
    samplingRatioPct: totalItems > 0 ? Number(((samples.length / totalItems) * 100).toFixed(1)) : 0,
    kappaAiVsHuman1: samples.length > 0 ? cohensKappa(aiLabels, human1Labels) : null,
    kappaHuman1VsHuman2:
      human2Labels.length === samples.length && samples.length > 0
        ? cohensKappa(human1Labels, human2Labels)
        : null,
  };
}
