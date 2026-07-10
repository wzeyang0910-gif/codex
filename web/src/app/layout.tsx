import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yonye Lead Platform",
  description: "Internal lead generation platform for Yonye Medical"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
