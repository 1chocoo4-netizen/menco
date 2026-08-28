import { NextResponse } from "next/server";
import { readOfflineData, updateSession } from "@/lib/offline-store";
import { analyzeSession } from "@/lib/gemini-analysis";
import { extractEarlyLate } from "@/lib/text";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const data = await readOfflineData();
  const session = data.sessions.find((s) => s.id === params.id);
  if (!session) {
    return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!session.transcript.trim()) {
    return NextResponse.json({ error: "분석할 대화 스크립트가 비어 있습니다." }, { status: 400 });
  }

  try {
    const { early, late } = extractEarlyLate(session.transcript);
    const result = await analyzeSession({
      transcript: session.transcript,
      earlySegment: early,
      lateSegment: late,
    });
    const updated = await updateSession(session.id, { aiAnalysis: result });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[offline analyze] 실패:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
