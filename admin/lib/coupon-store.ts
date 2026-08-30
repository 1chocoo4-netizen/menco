// 쿠폰 저장소.
// offline-store.ts와 동일하게, Supabase 등 실 DB가 붙기 전까지
// admin/data/coupons.json 파일에 직접 저장한다.
// ⚠️ next start로 상시 구동되는 서버(예: Render)에서는 정상 동작하지만, Vercel 등
// 서버리스/읽기전용 파일시스템 배포 환경에서는 쓰기가 유지되지 않으므로 주의.

import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR ? process.env.DATA_DIR : path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "coupons.json");

export type CouponStatus = "active" | "revoked";

export interface Coupon {
  id: string;
  code: string;
  description: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  status: CouponStatus;
  createdAt: string;
}

const EMPTY_DATA: Coupon[] = [];

let writeQueue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.catch(() => undefined);
  return result;
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(EMPTY_DATA, null, 2), "utf-8");
  }
}

export async function readCoupons(): Promise<Coupon[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw) as Coupon[];
  } catch {
    return [...EMPTY_DATA];
  }
}

async function writeCoupons(data: Coupon[]) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function genId() {
  return `C_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동되는 0/O, 1/I 제외

function genCode() {
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `MENCO-${body}`;
}

export function issueCoupons(input: {
  description: string;
  expiresAt: string | null;
  maxUses: number;
  quantity: number;
}): Promise<Coupon[]> {
  return withLock(async () => {
    const data = await readCoupons();
    const existingCodes = new Set(data.map((c) => c.code));
    const now = new Date().toISOString();

    for (let i = 0; i < input.quantity; i++) {
      let code = genCode();
      while (existingCodes.has(code)) code = genCode();
      existingCodes.add(code);
      data.push({
        id: genId(),
        code,
        description: input.description.trim(),
        maxUses: input.maxUses,
        usedCount: 0,
        expiresAt: input.expiresAt,
        status: "active",
        createdAt: now,
      });
    }

    await writeCoupons(data);
    return data;
  });
}

export function setCouponStatus(id: string, status: CouponStatus): Promise<Coupon[]> {
  return withLock(async () => {
    const data = await readCoupons();
    const coupon = data.find((c) => c.id === id);
    if (!coupon) throw new Error("쿠폰을 찾을 수 없습니다.");
    coupon.status = status;
    await writeCoupons(data);
    return data;
  });
}

export type RedeemResult = { ok: true } | { ok: false; error: string };

export function redeemCoupon(rawCode: string): Promise<RedeemResult> {
  return withLock(async () => {
    const code = rawCode.trim().toUpperCase();
    const data = await readCoupons();
    const coupon = data.find((c) => c.code === code);

    if (!coupon) return { ok: false, error: "유효하지 않은 쿠폰 코드입니다." };
    if (coupon.status === "revoked") return { ok: false, error: "비활성화된 쿠폰입니다." };
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: "만료된 쿠폰입니다." };
    }
    if (coupon.usedCount >= coupon.maxUses) return { ok: false, error: "이미 모두 사용된 쿠폰입니다." };

    coupon.usedCount += 1;
    await writeCoupons(data);
    return { ok: true };
  });
}

export function deleteCoupon(id: string): Promise<Coupon[]> {
  return withLock(async () => {
    const data = await readCoupons();
    const next = data.filter((c) => c.id !== id);
    await writeCoupons(next);
    return next;
  });
}
