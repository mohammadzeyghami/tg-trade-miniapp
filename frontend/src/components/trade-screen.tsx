"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, fmtBtc, fmtUsd } from "@/lib/app";

const BID = "#0d9488";
const ASK = "#ef4444";

export function TradeScreen() {
  const app = useApp();

  if (app.authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-lg font-semibold">ورود ناموفق</p>
        <p className="text-sm opacity-70">{app.authError}</p>
        <p className="text-xs opacity-50">
          مینی‌اپ را از داخل تلگرام باز کنید — یا بک‌اند را با TG_DEV_MODE=true اجرا کنید.
        </p>
      </div>
    );
  }
  if (!app.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm opacity-60">
        در حال ورود…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 p-3">
      <Header />
      <Balances />
      <MiniBook />
      <OrderForm />
      <OpenOrders />
      <Fills />
      <p className="pb-2 text-center text-[10px] opacity-40">
        paper trading · powered by go-mini-exchange
      </p>
    </div>
  );
}

function Header() {
  const { name, last, inTelegram } = useApp();
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-base font-bold">BTC/USDT</h1>
        <p className="text-xs opacity-60">
          {name} {inTelegram ? "" : "· dev mode"}
        </p>
      </div>
      <span className="font-mono text-xl font-bold">{last ? fmtUsd(last) : "—"}</span>
    </header>
  );
}

function Balances() {
  const { balances } = useApp();
  const usdt = balances.USDT ?? { available: 0, hold: 0 };
  const btc = balances.BTC ?? { available: 0, hold: 0 };
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: "USDT", val: fmtUsd(usdt.available), hold: usdt.hold ? fmtUsd(usdt.hold) : "" },
        { label: "BTC", val: fmtBtc(btc.available), hold: btc.hold ? fmtBtc(btc.hold) : "" },
      ].map((b) => (
        <div key={b.label} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
          <p className="text-[10px] uppercase opacity-50">{b.label}</p>
          <p className="font-mono text-sm">{b.val}</p>
          {b.hold && <p className="font-mono text-[10px] text-amber-400">hold {b.hold}</p>}
        </div>
      ))}
    </div>
  );
}

function MiniBook() {
  const { bids, asks } = useApp();
  const a = [...asks].slice(0, 5).reverse();
  const b = bids.slice(0, 5);
  const max = Math.max(1, ...a.map((l) => l.qty), ...b.map((l) => l.qty));
  const row = (l: { price: number; qty: number }, color: string) => (
    <div key={`${color}${l.price}`} className="relative grid grid-cols-2 px-2 py-[2px] font-mono text-[11px]">
      <div
        className="absolute inset-y-0 right-0 rounded-sm"
        style={{ width: `${Math.max(4, (l.qty / max) * 100)}%`, background: color, opacity: 0.15 }}
      />
      <span style={{ color }}>{fmtUsd(l.price)}</span>
      <span className="z-10 text-right opacity-60">{fmtBtc(l.qty)}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 py-1">
      {a.map((l) => row(l, ASK))}
      <div className="my-0.5 border-y border-white/10 px-2 py-0.5 text-center text-[10px] opacity-50">
        spread {a.length && b.length ? fmtUsd(a[a.length - 1].price - b[0].price) : "—"}
      </div>
      {b.map((l) => row(l, BID))}
    </div>
  );
}

function OrderForm() {
  const { api, refresh, last } = useApp();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg("");
    const qtySat = Math.round(parseFloat(qty) * 1e8);
    if (!qtySat || qtySat < 10000) {
      setMsg("حداقل ۰.۰۰۰۱ BTC");
      return;
    }
    const priceCents = type === "limit" ? Math.round(parseFloat(price) * 100) : 0;
    if (type === "limit" && (!priceCents || priceCents <= 0)) {
      setMsg("قیمت نامعتبر");
      return;
    }
    setBusy(true);
    try {
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ side, type, price: priceCents, qty: qtySat }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      const filled = (data.trades as { qty: number }[]).reduce((s, t) => s + t.qty, 0);
      setMsg(
        data.order.status === "filled"
          ? `✅ پر شد: ${fmtBtc(filled)} BTC`
          : data.order.status === "open"
            ? "📗 در book نشست"
            : `⏸ ${fmtBtc(filled)} پر شد، بقیه لغو`,
      );
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      setQty("");
      refresh();
    } catch (e) {
      setMsg(`⛔ ${e instanceof Error ? e.message : e}`);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-lg border border-white/15 bg-transparent px-2.5 py-2 font-mono text-sm outline-none focus:border-white/40";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setSide("buy")}
          className="rounded-lg py-2 text-sm font-semibold"
          style={{ background: side === "buy" ? BID : "rgba(255,255,255,.06)" }}
        >
          خرید
        </button>
        <button
          onClick={() => setSide("sell")}
          className="rounded-lg py-2 text-sm font-semibold"
          style={{ background: side === "sell" ? ASK : "rgba(255,255,255,.06)" }}
        >
          فروش
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <button
          onClick={() => setType("limit")}
          className={`rounded-lg py-1.5 ${type === "limit" ? "bg-white/15" : "bg-white/5 opacity-60"}`}
        >
          Limit
        </button>
        <button
          onClick={() => setType("market")}
          className={`rounded-lg py-1.5 ${type === "market" ? "bg-white/15" : "bg-white/5 opacity-60"}`}
        >
          Market
        </button>
      </div>
      {type === "limit" && (
        <div className="flex gap-1.5">
          <input
            className={input}
            inputMode="decimal"
            dir="ltr"
            placeholder="قیمت (USDT)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <button
            className="shrink-0 rounded-lg bg-white/10 px-2 text-[11px]"
            onClick={() => last && setPrice((last / 100).toFixed(2))}
          >
            آخرین
          </button>
        </div>
      )}
      <input
        className={input}
        inputMode="decimal"
        dir="ltr"
        placeholder="مقدار (BTC)"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={busy}
        onClick={submit}
        className="rounded-lg py-2.5 text-sm font-bold disabled:opacity-50"
        style={{ background: side === "buy" ? BID : ASK }}
      >
        {busy ? "…" : side === "buy" ? "خرید BTC" : "فروش BTC"}
      </motion.button>
      {msg && <p className="text-center text-xs">{msg}</p>}
    </div>
  );
}

function OpenOrders() {
  const { openOrders, api, refresh } = useApp();
  if (openOrders.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <p className="mb-1 text-xs font-semibold opacity-70">سفارش‌های باز</p>
      {openOrders.map((o) => (
        <div key={o.id} className="flex items-center gap-2 py-1 font-mono text-[11px]">
          <span style={{ color: o.side === "buy" ? BID : ASK }}>{o.side}</span>
          <span>{fmtUsd(o.price)}</span>
          <span className="opacity-60">{fmtBtc(o.remaining)} BTC</span>
          <button
            className="ms-auto rounded bg-white/10 px-2 py-0.5 text-[10px]"
            onClick={() =>
              api(`/api/orders/${o.id}`, { method: "DELETE" }).then(refresh)
            }
          >
            لغو
          </button>
        </div>
      ))}
    </div>
  );
}

function Fills() {
  const { fills } = useApp();
  if (fills.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
      <p className="mb-1 text-xs font-semibold opacity-70">پر شدن‌های من</p>
      <AnimatePresence initial={false}>
        {fills.slice(0, 6).map((f) => (
          <motion.div
            key={f.at + f.price}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 py-0.5 font-mono text-[11px]"
          >
            <span style={{ color: f.side === "buy" ? BID : ASK }}>{f.side}</span>
            <span>{fmtBtc(f.qty)} BTC</span>
            <span className="opacity-60">@ {fmtUsd(f.price)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
