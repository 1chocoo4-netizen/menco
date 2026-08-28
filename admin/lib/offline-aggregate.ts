// 오프라인 연구 데이터(admin/data/offline-research.json)를 대시보드에서 쓰는
// DemographicRecord / CompetencyRecord 형태로 변환한다.

import type { OfflineData } from "./offline-store";
import type { AgeGroup, CompetencyRecord, DemographicRecord } from "./mock-data";

export function ageToGroup(age: number): AgeGroup {
  if (age < 10) return "10대 이하";
  if (age < 20) return "10대";
  if (age < 30) return "20대";
  if (age < 40) return "30대";
  return "40대 이상";
}

export function offlineDemographicRecords(data: OfflineData): DemographicRecord[] {
  return data.participants.map((p) => ({ gender: p.gender, ageGroup: ageToGroup(p.age) }));
}

/**
 * 코칭 효과 비교용 레코드를 두 가지 출처에서 만든다.
 *   1) 자기보고 설문(양적): 사전/사후 설문이 모두 제출된 세션 → 문항 평균 기반 점수
 *   2) AI 스크립트 분석(질적 근거 기반): 코칭 시작 구간/종료 구간 각각에서 AI가 원문 근거로
 *      매긴 점수. 두 구간 모두 confidence가 "none"이 아닌 경우에만(=실제 근거가 있을 때만)
 *      레코드로 인정한다 — 근거가 없어 0점 처리된 항목을 "감소"로 오인하지 않도록 하기 위함.
 * 참가자 한 명이 세션을 여러 번 진행했다면 세션별로 각각 레코드가 생긴다.
 */
export function offlineCompetencyRecords(data: OfflineData): CompetencyRecord[] {
  const records: CompetencyRecord[] = [];

  for (const session of data.sessions) {
    const participant = data.participants.find((p) => p.id === session.participantId);
    if (!participant) continue;
    const ageGroup = ageToGroup(participant.age);

    const pre = data.surveys.find((s) => s.sessionId === session.id && s.type === "pre");
    const post = data.surveys.find((s) => s.sessionId === session.id && s.type === "post");
    if (pre && post) {
      for (const preItem of pre.result.subScaleScores) {
        const postItem = post.result.subScaleScores.find((x) => x.subScale === preItem.subScale);
        if (!postItem) continue;
        records.push({
          userId: `${participant.id}:${session.id}:survey`,
          gender: participant.gender,
          ageGroup,
          subScale: preItem.subScale,
          pre: preItem.score,
          post: postItem.score,
        });
      }
    }

    const ai = session.aiAnalysis;
    if (ai) {
      for (const earlyItem of ai.llm.earlyCompetencyAssessments) {
        const lateItem = ai.llm.lateCompetencyAssessments.find((x) => x.subScale === earlyItem.subScale);
        if (!lateItem) continue;
        if (earlyItem.confidence === "none" || lateItem.confidence === "none") continue;
        records.push({
          userId: `${participant.id}:${session.id}:ai_script`,
          gender: participant.gender,
          ageGroup,
          subScale: earlyItem.subScale,
          pre: earlyItem.score,
          post: lateItem.score,
        });
      }
    }
  }

  return records;
}
