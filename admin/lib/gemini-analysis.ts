// 대화 전문(transcript)에 대한 근거 기반 분석 엔진.
//
// 핵심 설계: "코칭 시작 구간"과 "코칭 종료 구간"을 명시적으로 나눠서 각각 독립적으로
// 분석한다. 4C 역량 점수도 전체 대화 하나로 뭉뚱그려 매기지 않고, 시작 구간 근거만으로
// 매긴 점수(pre)와 종료 구간 근거만으로 매긴 점수(post)를 따로 산출해서, "코칭 시작 시점의
// 언어"와 "코칭 종료 시점의 언어"를 직접 비교해 효과를 검증할 수 있게 한다.
//
// 학술적 채택력을 위한 설계 원칙 두 가지를 반영한다.
//
// 1) 신뢰도(Inter-rater Reliability): 이 함수는 "AI 코더" 1명의 1차 코딩 결과만 생성한다.
//    논문에서는 전체 세션의 10~20%를 무작위 추출해 인간 평정자(연구자/멘탈코칭 전문가 2인)가
//    별도로 수동 코딩한 뒤, admin/lib/reliability.ts의 cohensKappa/iccTwoWay로 AI-인간 및
//    인간-인간 일치도를 계산해 병기해야 한다. 이 파일은 그 "AI 코딩" 절반만 담당한다.
//
// 2) 어휘사전 기준 명시: 긍/부정 "비율"의 최종 수치는 LLM의 자유 판단이 아니라, 결정론적
//    어휘사전 매칭(admin/lib/lexicon.ts, KNU 한국어 감성사전 기준)으로 계산한다. LLM에게는
//    "원문에 실제로 등장하는 표현만 후보로 추출"하도록 지시해, 자유 판단에서 오는 비일관성과
//    환각 위험을 최종 수치 산출 단계에서 배제한다.

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { competencySubScales } from "./mock-data";
import { SAMPLE_LEXICON, scoreTextSentiment, tfidfKeywords, type SentimentLexicon } from "./lexicon";

const SUBSCALE_NAMES = competencySubScales.map((s) => s.subScale);

function buildSystemInstruction(): string {
  return `너는 심리학/코칭 연구를 보조하는 대화 분석 코더(coder)야. 아래 원칙을 반드시 지켜라.

[구간 분리 — 매우 중요]
사용자 메시지는 [코칭 시작 구간]과 [코칭 종료 구간]으로 명확히 나뉘어 주어진다.
- earlyCompetencyAssessments는 반드시 [코칭 시작 구간] 텍스트에 있는 근거만으로 판단하라.
- lateCompetencyAssessments는 반드시 [코칭 종료 구간] 텍스트에 있는 근거만으로 판단하라.
- 다른 구간의 내용을 근거로 섞어 쓰지 마라. 두 구간은 "코칭 전/후 비교"를 위해 독립적으로 채점된다.

[역할 범위]
- 긍정/부정 어휘의 최종 비율은 네가 계산하지 않는다. 별도의 결정론적 어휘사전 알고리즘이 계산한다.
- 너의 역할은 (a) 각 구간에 "실제로 등장하는" 감정 표현 후보 단어/구를 그대로 추출하는 것과,
  (b) 각 구간별로 4C 역량(도전/전념/조절/자신감) 하위 지표 근거가 있는지 판단하는 것뿐이다.
- 원문에 없는 단어를 만들어내거나 의역하지 마라. 인용은 반드시 원문 그대로(verbatim)여야 한다.
- 해당 구간에 명확한 근거가 없는 항목은 score를 0으로, confidence를 "none"으로, evidenceQuote를
  빈 문자열로 남겨라. 근거가 약하면 추측하지 말고 "none" 또는 "low"로 보수적으로 표시하라(환각 방지).

[4C 역량 하위 지표]
${SUBSCALE_NAMES.map((n) => `- ${n}`).join("\n")}

[출력]
JSON 스키마를 그대로 따르고, 스키마 외 텍스트는 출력하지 마라.`;
}

const competencyAssessmentSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      subScale: { type: Type.STRING, enum: SUBSCALE_NAMES },
      score: { type: Type.NUMBER, description: "1~10점. 근거 없으면 0." },
      confidence: { type: Type.STRING, enum: ["none", "low", "medium", "high"] },
      evidenceQuote: { type: Type.STRING, description: "해당 구간 원문 그대로의 인용구. 근거 없으면 빈 문자열." },
    },
    required: ["subScale", "score", "confidence", "evidenceQuote"],
  },
};

const candidateWordsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    positive: { type: Type.ARRAY, items: { type: Type.STRING } },
    negative: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["positive", "negative"],
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    earlyCompetencyAssessments: competencyAssessmentSchema,
    lateCompetencyAssessments: competencyAssessmentSchema,
    earlySegmentCandidateWords: candidateWordsSchema,
    lateSegmentCandidateWords: candidateWordsSchema,
  },
  required: [
    "earlyCompetencyAssessments",
    "lateCompetencyAssessments",
    "earlySegmentCandidateWords",
    "lateSegmentCandidateWords",
  ],
};

export interface AnalyzeSessionInput {
  /** 세션 전체 대화 전문 (화자 구분 포함 권장) */
  transcript: string;
  /** 코칭 시작 구간 (예: 초반 3~5문장) */
  earlySegment: string;
  /** 코칭 종료 구간 (예: 후반 3~5문장) */
  lateSegment: string;
  /** 결정론적 채점에 사용할 사전. 미지정 시 데모용 SAMPLE_LEXICON 사용 (실 연구에는 KNU 사전 주입 필요) */
  lexicon?: SentimentLexicon;
}

export interface CompetencyAssessment {
  subScale: string;
  score: number;
  confidence: "none" | "low" | "medium" | "high";
  evidenceQuote: string;
}

export interface AnalyzeSessionResult {
  llm: {
    earlyCompetencyAssessments: CompetencyAssessment[];
    lateCompetencyAssessments: CompetencyAssessment[];
    earlySegmentCandidateWords: { positive: string[]; negative: string[] };
    lateSegmentCandidateWords: { positive: string[]; negative: string[] };
  };
  deterministic: {
    early: ReturnType<typeof scoreTextSentiment>;
    late: ReturnType<typeof scoreTextSentiment>;
    tfidfKeywords: { term: string; score: number }[];
  };
  methodology: {
    lexiconBasis: string;
    coderNote: string;
  };
}

export async function analyzeSession(input: AnalyzeSessionInput): Promise<AnalyzeSessionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const model = process.env.GEMINI_ANALYSIS_MODEL || "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });

  const promptText = `[코칭 시작 구간]
${input.earlySegment}

[코칭 종료 구간]
${input.lateSegment}

[전체 대화 전문 — 문맥 참고용. 위 두 구간의 근거만 채점에 사용할 것]
${input.transcript}`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }],
      },
    ],
    config: {
      systemInstruction: buildSystemInstruction(),
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const llm = JSON.parse(response.text ?? "{}") as AnalyzeSessionResult["llm"];

  const lexicon = input.lexicon ?? SAMPLE_LEXICON;
  const early = scoreTextSentiment(input.earlySegment, lexicon);
  const late = scoreTextSentiment(input.lateSegment, lexicon);
  const keywords = tfidfKeywords([input.earlySegment, input.lateSegment], 1);

  return {
    llm,
    deterministic: { early, late, tfidfKeywords: keywords },
    methodology: {
      lexiconBasis:
        input.lexicon === undefined
          ? "⚠️ 데모용 SAMPLE_LEXICON 사용 중 — 실 연구 결과에는 KNU 한국어 감성사전으로 교체 필요"
          : "지정된 사전 기준으로 산출됨",
      coderNote:
        "이 결과는 AI 1차 코딩입니다. 논문 게재를 위해서는 전체의 10~20% 표본을 인간 평정자 2인이 " +
        "별도로 코딩하고, admin/lib/reliability.ts의 cohensKappa로 일치도를 산출해 함께 보고해야 합니다.",
    },
  };
}
