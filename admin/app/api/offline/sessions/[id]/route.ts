import { NextRequest, NextResponse } from "next/server";
import { deleteSession, updateSession } from "@/lib/offline-store";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const patch: { coachOpinion?: string; transcript?: string } = {};
  if (typeof body?.coachOpinion === "string") patch.coachOpinion = body.coachOpinion;
  if (typeof body?.transcript === "string") patch.transcript = body.transcript;

  try {
    const data = await updateSession(params.id, patch);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "업데이트 실패" },
      { status: 404 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const data = await deleteSession(params.id);
  return NextResponse.json(data);
}
