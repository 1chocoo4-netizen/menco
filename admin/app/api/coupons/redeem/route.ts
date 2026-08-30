// 멘코 음성 코칭 서버(server.js)가 세션 시작 전 쿠폰 코드를 검증·차감하기 위해
// 호출하는 내부 전용 엔드포인트. 브라우저에서 직접 호출하지 않으며,
// x-internal-token 헤더로 서버 간 호출만 허용한다.

import { NextRequest, NextResponse } from "next/server";
import { redeemCoupon } from "@/lib/coupon-store";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-internal-token");
  if (!process.env.INTERNAL_API_TOKEN || token !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ ok: false, error: "쿠폰 코드를 입력해주세요." }, { status: 400 });
  }

  const result = await redeemCoupon(code);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
