import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "멘코 어드민",
  description: "AI 멘탈코치 멘코의 관리자 페이지",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg font-sans antialiased">
        <Sidebar />
        <div className="md:pl-64">{children}</div>
      </body>
    </html>
  );
}
