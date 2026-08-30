import { NextRequest, NextResponse } from "next/server";
import { deleteCoupon, setCouponStatus, type CouponStatus } from "@/lib/coupon-store";

const VALID_STATUSES: CouponStatus[] = ["active", "revoked"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "status는 active | revoked 여야 합니다." }, { status: 400 });
  }
  const data = await setCouponStatus(params.id, status);
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const data = await deleteCoupon(params.id);
  return NextResponse.json(data);
}
