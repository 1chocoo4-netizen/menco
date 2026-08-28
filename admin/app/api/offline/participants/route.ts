import { NextRequest, NextResponse } from "next/server";
import { addParticipant } from "@/lib/offline-store";
import type { Gender } from "@/lib/mock-data";

const VALID_GENDERS: Gender[] = ["female", "male", "unspecified"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const gender = body?.gender;
  const age = Number(body?.age);

  if (!name || !VALID_GENDERS.includes(gender) || !Number.isFinite(age) || age <= 0 || age > 120) {
    return NextResponse.json({ error: "name, gender, age(1~120)가 필요합니다." }, { status: 400 });
  }

  const data = await addParticipant({ name, gender, age });
  return NextResponse.json(data);
}
