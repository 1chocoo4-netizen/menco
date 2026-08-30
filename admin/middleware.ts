import { NextRequest, NextResponse } from "next/server";

// 관리자 페이지 전체를 HTTP Basic Auth로 보호한다.
// 단, server.js가 서버 간 호출로 사용하는 온라인 세션 저장/쿠폰 검증 엔드포인트는
// 자체 토큰(x-internal-token) 인증을 쓰므로 여기서는 제외한다.
export function middleware(req: NextRequest) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    // 환경변수가 설정되지 않으면 안전한 기본값으로 접근을 차단한다.
    return new NextResponse("관리자 인증이 설정되지 않았습니다 (ADMIN_USERNAME/ADMIN_PASSWORD 필요)", {
      status: 503,
    });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    if (user === username && pass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MENCO Admin"' },
  });
}

export const config = {
  matcher: ["/((?!api/offline/online-capture|api/coupons/redeem|_next/static|_next/image|favicon.ico).*)"],
};
