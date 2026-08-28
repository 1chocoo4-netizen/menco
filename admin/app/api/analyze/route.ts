import { NextRequest, NextResponse } from "next/server";
import { analyzeSession } from "@/lib/gemini-analysis";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body?.transcript || !body?.earlySegment || !body?.lateSegment) {
    return NextResponse.json(
      { error: "transcript, earlySegment, lateSegment는 필수입니다." },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeSession({
      transcript: body.transcript,
      earlySegment: body.earlySegment,
      lateSegment: body.lateSegment,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[analyze] 분석 실패:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
