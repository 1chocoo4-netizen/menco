import { NextResponse } from "next/server";
import { readOfflineData } from "@/lib/offline-store";

// 이 GET 핸들러는 요청 시마다 최신 파일 내용을 읽어야 하므로 정적 캐싱을 금지한다.
// (마킹하지 않으면 Next.js가 빌드 시점 스냅샷을 정적으로 캐시해버려, 이후 등록한
// 참가자/세션이 화면에 반영되지 않는 문제가 생긴다.)
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readOfflineData();
  return NextResponse.json(data);
}
