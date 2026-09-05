import type { Metadata } from "next";
import Script from "next/script";
import { Geist_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({ subsets: ["arabic"], variable: "--font-vazir" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "tg-trade-miniapp",
  description: "Paper-trading Telegram mini app on go-mini-exchange",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${vazir.variable} ${mono.variable}`}>
      <body
        className="min-h-screen"
        style={{
          background: "var(--tg-theme-bg-color, #0f0f0f)",
          color: "var(--tg-theme-text-color, #f4f4f5)",
          fontFamily: "var(--font-vazir), system-ui, sans-serif",
        }}
      >
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
