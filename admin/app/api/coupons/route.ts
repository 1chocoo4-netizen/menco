import { NextRequest, NextResponse } from "next/server";
import { issueCoupons, readCoupons } from "@/lib/coupon-store";

// 파일 기반 저장소이므로 빌드 시점 정적 캐싱을 금지한다.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readCoupons();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
  const maxUses = Number(body?.maxUses ?? 1);
  const quantity = Number(body?.quantity ?? 1);

  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100000) {
    return NextResponse.json({ error: "maxUses는 1~100000 사이여야 합니다." }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 200) {
    return NextResponse.json({ error: "quantity는 1~200 사이여야 합니다." }, { status: 400 });
  }

  const data = await issueCoupons({ description, expiresAt, maxUses, quantity });
  return NextResponse.json(data);
}
