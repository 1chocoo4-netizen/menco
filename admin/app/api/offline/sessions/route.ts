import { NextRequest, NextResponse } from "next/server";
import { addSession } from "@/lib/offline-store";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const participantId = body?.participantId;
  const date = body?.date;
  const transcript = typeof body?.transcript === "string" ? body.transcript : "";
  const coachOpinion = typeof body?.coachOpinion === "string" ? body.coachOpinion : "";

  if (!participantId || !date) {
    return NextResponse.json({ error: "participantId, date가 필요합니다." }, { status: 400 });
  }

  const data = await addSession({ participantId, date, transcript, coachOpinion });
  return NextResponse.json(data);
}
