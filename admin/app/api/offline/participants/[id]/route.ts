import { NextResponse } from "next/server";
import { deleteParticipant } from "@/lib/offline-store";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const data = await deleteParticipant(params.id);
  return NextResponse.json(data);
}
