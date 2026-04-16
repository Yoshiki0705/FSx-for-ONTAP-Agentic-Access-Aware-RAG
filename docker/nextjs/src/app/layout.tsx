import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Application with NetApp ONTAP",
  description: "Permission-aware RAG system with FSx for NetApp ONTAP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // [locale]/layout.tsx が <html> と <body> を提供するため、
  // ルートレイアウトは children をそのまま返す（二重ネスト防止）
  return children;
}
