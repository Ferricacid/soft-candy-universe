import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const socialImagePath = `${publicBasePath}/og.png`;
  const deploymentUrl =
    process.env.DEPLOY_PRIME_URL ??
    process.env.URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://soft-candy-universe-lucy.lucy3007.chatgpt.site";
  const metadataBase = new URL(
    deploymentUrl.startsWith("http://") || deploymentUrl.startsWith("https://")
      ? deploymentUrl
      : `https://${deploymentUrl}`,
  );

  return {
    metadataBase,
    title: "软糖小宇宙｜捏一块属于你的软糖",
    description: "调节回弹、蓄力、颜色、文字和音效，创造一块可以长按揉捏的电子软糖。",
    openGraph: {
      title: "软糖小宇宙",
      description: "给今天一点柔软。",
      type: "website",
      images: [{ url: socialImagePath, width: 1748, height: 912, alt: "软糖小宇宙" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "软糖小宇宙",
      description: "给今天一点柔软。",
      images: [socialImagePath],
    },
    icons: { icon: `${publicBasePath}/favicon.svg` },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
