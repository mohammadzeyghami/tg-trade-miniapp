"use client";

import { AppProvider } from "@/lib/app";
import { TradeScreen } from "@/components/trade-screen";

export default function Home() {
  return (
    <AppProvider>
      <TradeScreen />
    </AppProvider>
  );
}
