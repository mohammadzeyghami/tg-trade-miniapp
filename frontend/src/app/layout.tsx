import type { Metadata } from "next";
import Script from "next/script";
import { Geist_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";

const vazir = Vazirmatn({ subsets: ["arabic"], variable: "--font-vazir" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "مینی‌اپ ترید",
  description: "Paper-trading Telegram mini app on go-mini-exchange",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%232dd4bf'/%3E%3Cpath d='M9 20.5 L14 11.5 L18 17.5 L23 9.5' stroke='%230a0b0e' stroke-width='2.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E",
  },
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
          background:
            "radial-gradient(700px 380px at 100% -5%, rgba(124,108,240,0.12), transparent 60%), radial-gradient(600px 320px at 0% 0%, rgba(45,212,191,0.08), transparent 55%), var(--tg-theme-bg-color, #0c0d11)",
          backgroundAttachment: "fixed",
          color: "var(--tg-theme-text-color, #edeef2)",
          fontFamily: "var(--font-vazir), system-ui, sans-serif",
        }}
      >
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
