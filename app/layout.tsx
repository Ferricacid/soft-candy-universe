import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "软糖小宇宙｜捏一块属于你的软糖",
    description: "调节回弹、蓄力、颜色、文字和音效，创造一块可以长按揉捏的电子软糖。",
    openGraph: {
      title: "软糖小宇宙",
      description: "给今天一点柔软。",
      type: "website",
      images: [{ url: "/og.png", width: 1748, height: 912, alt: "软糖小宇宙" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "软糖小宇宙",
      description: "给今天一点柔软。",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
