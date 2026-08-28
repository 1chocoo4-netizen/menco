// 감성 어휘사전(Lexicon) 기반 긍/부정 판별 유틸리티.
//
// ⚠️ 중요: 아래 SAMPLE_LEXICON은 구조 검증용 예시(약 20단어)일 뿐이며, 실제 논문에 사용할
// 학술 표준 사전이 아니다. 실 서비스/연구에서는 반드시 검증된 사전으로 교체해야 한다.
//   - KNU 한국어 감성사전 (박상민 외, 군산대학교 자연언어처리연구실 배포)
//   - KOSAC(Korean Sentiment Analysis Corpus, 서울대학교 언어학과)
// 사전 파일(csv/json)을 확보한 뒤 loadLexiconFromEntries()로 불러와 SAMPLE_LEXICON을 대체한다.
// 이 모듈은 어떤 사전을 넣어도 동일하게 동작하도록 설계했다.

export type PolarityLabel = "긍정" | "부정" | "중립";

export interface LexiconEntry {
  word: string;
  /** 사전 표준 극성 점수. KNU 사전 기준 대략 -2(매우 부정) ~ +2(매우 긍정) */
  polarity: number;
}

export type SentimentLexicon = Map<string, number>;

export function loadLexiconFromEntries(entries: LexiconEntry[]): SentimentLexicon {
  return new Map(entries.map((e) => [e.word, e.polarity]));
}

// 구조 검증 및 데모용 예시 어휘 20개. 실제 KNU/KOSAC 사전으로 교체 전까지만 사용.
export const SAMPLE_LEXICON: SentimentLexicon = loadLexiconFromEntries([
  { word: "불안", polarity: -2 },
  { word: "실패", polarity: -2 },
  { word: "못해", polarity: -1 },
  { word: "힘들", polarity: -1 },
  { word: "걱정", polarity: -1 },
  { word: "지쳐", polarity: -1 },
  { word: "포기", polarity: -2 },
  { word: "안될", polarity: -1 },
  { word: "번아웃", polarity: -2 },
  { word: "우울", polarity: -2 },
  { word: "성장", polarity: 2 },
  { word: "자신감", polarity: 2 },
  { word: "해볼", polarity: 1 },
  { word: "선명", polarity: 1 },
  { word: "감사", polarity: 2 },
  { word: "설레", polarity: 1 },
  { word: "뿌듯", polarity: 2 },
  { word: "기대", polarity: 1 },
  { word: "회복", polarity: 1 },
  { word: "가능", polarity: 1 },
]);

/**
 * 매우 단순한 공백/음절 기반 어절 분리. 한국어 교착어 특성상 정밀한 형태소 분석이
 * 필요하므로, 실 연구 파이프라인에서는 mecab-ko/eunjeon 등 형태소 분석기로 대체 권장.
 * (이 함수는 사전 매칭을 위한 부분 문자열 스캔 방식으로, 형태소 분석 없이도
 * "-불안하고", "성장했다" 처럼 어휘가 포함된 형태를 인식할 수 있게 설계했다.)
 */
export interface SentimentScoreResult {
  matchedWords: { word: string; polarity: number; count: number }[];
  positiveCount: number;
  negativeCount: number;
  totalWords: number;
  positiveRatioPct: number;
  negativeRatioPct: number;
}

export function scoreTextSentiment(text: string, lexicon: SentimentLexicon = SAMPLE_LEXICON): SentimentScoreResult {
  const totalWords = text.split(/\s+/).filter(Boolean).length || 1;
  const matched: { word: string; polarity: number; count: number }[] = [];
  let positiveCount = 0;
  let negativeCount = 0;

  for (const [word, polarity] of lexicon) {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const count = (text.match(regex) ?? []).length;
    if (count === 0) continue;
    matched.push({ word, polarity, count });
    if (polarity > 0) positiveCount += count;
    if (polarity < 0) negativeCount += count;
  }

  return {
    matchedWords: matched,
    positiveCount,
    negativeCount,
    totalWords,
    positiveRatioPct: Number(((positiveCount / totalWords) * 100).toFixed(1)),
    negativeRatioPct: Number(((negativeCount / totalWords) * 100).toFixed(1)),
  };
}

/**
 * TF-IDF 기반 핵심 키워드 추출. 사전과 무관하게, 문서 집합(예: 세션별 발화 묶음) 내에서
 * 특정 세션에 상대적으로 많이 등장하는 단어를 뽑아 LIWC류 텍스트마이닝 교차검증에 사용한다.
 */
export function tfidfKeywords(documents: string[], targetIndex: number, topN = 10): { term: string; score: number }[] {
  const tokenize = (doc: string) => doc.split(/[\s,.!?"'()]+/).filter((t) => t.length > 1);

  const docTokens = documents.map(tokenize);
  const targetTokens = docTokens[targetIndex] ?? [];

  const tf = new Map<string, number>();
  for (const t of targetTokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  const N = documents.length;
  const scores: { term: string; score: number }[] = [];
  for (const [term, count] of tf) {
    const df = docTokens.filter((tokens) => tokens.includes(term)).length || 1;
    const idf = Math.log(N / df + 1);
    scores.push({ term, score: Number(((count / targetTokens.length) * idf).toFixed(4)) });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, topN);
}
