import { NextRequest, NextResponse } from "next/server";
import { addSurveyResponse } from "@/lib/offline-store";
import { scoreSurvey, SURVEY_ITEMS } from "@/lib/survey";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { participantId, sessionId, type, answers } = body ?? {};

  if (!participantId || !sessionId || (type !== "pre" && type !== "post") || typeof answers !== "object") {
    return NextResponse.json(
      { error: "participantId, sessionId, type(pre/post), answers가 필요합니다." },
      { status: 400 }
    );
  }

  const missing = SURVEY_ITEMS.filter((item) => !(item.id in answers));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `응답하지 않은 문항이 있습니다: ${missing.map((m) => m.id).join(", ")}` },
      { status: 400 }
    );
  }

  const result = scoreSurvey(answers);
  const data = await addSurveyResponse({ participantId, sessionId, type, answers, result });
  return NextResponse.json(data);
}
