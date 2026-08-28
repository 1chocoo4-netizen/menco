// 대화 전문에서 초반/후반 구간을 자동으로 추출하는 유틸.
// 정밀한 화자분리·문장분리가 필요하면 형태소 분석기 기반으로 교체 권장. 여기서는
// 마크다운 잡음(제목, 굵게 표시된 화자 태그, 구분선)을 걷어낸 뒤, 마침표/물음표/느낌표
// 기준으로 문장을 분리하는 방식으로 근사한다.

function isNoiseLine(rawLine: string): boolean {
  const line = rawLine.trim();
  if (!line) return true;
  if (/^#{1,6}\s/.test(line)) return true; // 마크다운 제목
  if (/^-{3,}$/.test(line)) return true; // 구분선(---)
  if (/^\*+$/.test(line)) return true;
  const withoutBold = line.replace(/\*\*/g, "").trim();
  // "멘코:", "코치:", "서진:" 같이 화자 이름만 있는 줄
  if (/^[가-힣A-Za-z0-9\s]{1,12}[:：]$/.test(withoutBold)) return true;
  return false;
}

export function splitSentences(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .filter((line) => !isNoiseLine(line))
    .map((line) => line.replace(/\*\*/g, "").trim())
    .filter(Boolean);

  const sentences: string[] = [];
  for (const line of lines) {
    const parts = line
      .split(/(?<=[.!?요다까])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    sentences.push(...(parts.length > 0 ? parts : [line]));
  }
  return sentences.filter((s) => s.length > 1);
}

export function extractEarlyLate(transcript: string, count = 8): { early: string; late: string } {
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) return { early: "", late: "" };
  const early = sentences.slice(0, count).join(" ");
  const late = sentences.slice(-count).join(" ");
  return { early, late };
}
