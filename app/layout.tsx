import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "서울 제퍼디 LIVE", description: "조와 이름으로 함께하는 서울 퀴즈쇼", icons: {icon: "/favicon.svg"} };
export default function RootLayout({children}: {children: React.ReactNode}) {return <html lang="ko"><body>{children}</body></html>;}
