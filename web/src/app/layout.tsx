import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "原研获客平台",
  description: "原研医疗内部获客与客户管理工具"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
