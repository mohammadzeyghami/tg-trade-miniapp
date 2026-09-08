"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useApp, fmtBtc, fmtUsd } from "@/lib/app";

const UP = "var(--up)";
const DOWN = "var(--down)";

export function TradeScreen() {
  const app = useApp();

  if (app.authError) {
    return (
      <Centered>
        <p className="text-lg font-semibold">ورود ناموفق</p>
        <p className="text-sm opacity-70">{app.authError}</p>
        <p className="mt-1 text-xs opacity-50">
          مینی‌اپ را از داخل تلگرام باز کنید — یا بک‌اند را با TG_DEV_MODE=true اجرا کنید.
        </p>
      </Centered>
    );
  }
  if (!app.ready) {
    return (
      <Centered>
        <div className="flex items-center gap-2 text-sm opacity-70">
          <span className="size-2 animate-pulse rounded-full" style={{ background: UP }} />
          در حال ورود…
        </div>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 p-3">
      <Header />
      <Balances />
      <MiniBook />
      <OrderTicket />
      <OpenOrders />
      <Fills />
      <p className="pb-3 pt-1 text-center text-[10px] opacity-40">
        paper trading · powered by go-mini-exchange
      </p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-1.5 p-6 text-center">
      {children}
    </div>
  );
}

function Header() {
  const { name, last, inTelegram } = useApp();
  const prev = useRef(last);
  const up = last >= prev.current;
  prev.current = last;
  return (
    <header className="sticky top-0 z-10 -mx-3 mb-1 flex items-center justify-between border-b px-3 py-2.5 backdrop-blur-xl"
      style={{ borderColor: "var(--line)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
      <div className="flex items-center gap-2">
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
          <rect width="32" height="32" rx="9" fill="url(#tg)" />
          <path d="M9 20.5 L14 11.5 L18 17.5 L23 9.5" stroke="#0a0b0e" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <defs><linearGradient id="tg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#8b7cf2" /><stop offset="1" stopColor="#2dd4bf" /></linearGradient></defs>
        </svg>
        <div className="leading-tight">
          <div className="text-sm font-bold">BTC<span className="opacity-50">/USDT</span></div>
          <div className="mlabel normal-case tracking-normal">
            {name} {inTelegram ? "" : "· dev"}
          </div>
        </div>
      </div>
      <div className="text-left">
        <div className="mlabel">آخرین قیمت</div>
        <motion.div
          key={last}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          className={`font-mono text-lg font-bold tnum leading-none ${up ? "up" : "down"}`}
          dir="ltr"
        >
          {last ? fmtUsd(last) : "—"}
        </motion.div>
      </div>
    </header>
  );
}

function Balances() {
  const { balances } = useApp();
  const usdt = balances.USDT ?? { available: 0, hold: 0 };
  const btc = balances.BTC ?? { available: 0, hold: 0 };
  const tile = (asset: string, val: string, hold: string | null) => (
    <div className="mpanel p-2.5">
      <div className="flex items-center justify-between">
        <span className="mlabel">{asset}</span>
        {hold && (
          <span className="rounded-full px-1.5 py-0.5 font-mono text-[9px] tnum" style={{ color: "var(--hold)", background: "color-mix(in srgb, var(--hold) 14%, transparent)" }} dir="ltr">
            hold {hold}
          </span>
        )}
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold tnum" dir="ltr">{val}</div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {tile("USDT", fmtUsd(usdt.available), usdt.hold > 0 ? fmtUsd(usdt.hold) : null)}
      {tile("BTC", fmtBtc(btc.available), btc.hold > 0 ? fmtBtc(btc.hold) : null)}
    </div>
  );
}

function MiniBook() {
  const { bids, asks } = useApp();
  const a = [...asks].slice(0, 5).reverse();
  const b = bids.slice(0, 5);
  const max = Math.max(1, ...a.map((l) => l.qty), ...b.map((l) => l.qty));
  const loading = a.length === 0 && b.length === 0;
  const row = (l: { price: number; qty: number }, color: string) => (
    <div key={`${color}${l.price}`} className="relative grid grid-cols-2 px-2.5 py-[3px] font-mono text-[11px] tnum" dir="ltr">
      <div className="absolute inset-y-px right-0 rounded-l-sm" style={{ width: `${Math.max(3, (l.qty / max) * 100)}%`, background: color, opacity: 0.13 }} />
      <span className="z-10" style={{ color }}>{fmtUsd(l.price)}</span>
      <span className="z-10 text-right opacity-60">{fmtBtc(l.qty)}</span>
    </div>
  );
  return (
    <div className="mpanel overflow-hidden py-1">
      {loading ? (
        <div className="flex flex-col gap-1 p-2">
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="mskeleton h-3.5" />)}
        </div>
      ) : (
        <>
          {a.map((l) => row(l, DOWN))}
          <div className="my-0.5 border-y px-2.5 py-0.5 text-center text-[10px] opacity-55" style={{ borderColor: "var(--line)" }} dir="ltr">
            spread {a.length && b.length ? fmtUsd(a[a.length - 1].price - b[0].price) : "—"}
          </div>
          {b.map((l) => row(l, UP))}
        </>
      )}
    </div>
  );
}

function OrderTicket() {
  const { api, refresh, last, balances } = useApp();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"limit" | "market">("market");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const buy = side === "buy";
  const accent = buy ? UP : DOWN;

  const setPct = (p: number) => {
    const ref = type === "limit" ? parseFloat(price) : last / 100;
    if (!ref || ref <= 0) return;
    const maxBtc = buy ? (balances.USDT?.available ?? 0) / 100 / ref : (balances.BTC?.available ?? 0) / 1e8;
    const q = maxBtc * p * 0.999;
    if (q > 0) setQty(q.toFixed(4));
  };

  const submit = async () => {
    setMsg("");
    const qtySat = Math.round(parseFloat(qty) * 1e8);
    if (!qtySat || qtySat < 10000) return setMsg("حداقل ۰.۰۰۰۱ BTC");
    const priceCents = type === "limit" ? Math.round(parseFloat(price) * 100) : 0;
    if (type === "limit" && (!priceCents || priceCents <= 0)) return setMsg("قیمت نامعتبر");
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
        data.order.status === "filled" ? `✅ پر شد: ${fmtBtc(filled)} BTC`
          : data.order.status === "open" ? "📗 در order book نشست"
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

  const input = "w-full rounded-lg border bg-transparent px-2.5 py-2 font-mono text-sm outline-none focus:border-white/40";
  const avail = buy ? `${fmtUsd(balances.USDT?.available ?? 0)} USDT` : `${fmtBtc(balances.BTC?.available ?? 0)} BTC`;

  return (
    <div className="mpanel flex flex-col gap-2.5 p-3">
      {/* buy/sell segmented */}
      <div className="relative grid grid-cols-2 rounded-lg p-1" style={{ background: "color-mix(in srgb, var(--bg) 60%, #000)" }}>
        <motion.div layout transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className="absolute inset-y-1 w-[calc(50%-4px)] rounded-md"
          style={{ background: accent, opacity: 0.18, left: buy ? 4 : "auto", right: buy ? "auto" : 4 }} />
        <button onClick={() => setSide("buy")} className="z-10 rounded-md py-1.5 text-sm font-bold" style={{ color: buy ? UP : "var(--sub)" }}>خرید</button>
        <button onClick={() => setSide("sell")} className="z-10 rounded-md py-1.5 text-sm font-bold" style={{ color: !buy ? DOWN : "var(--sub)" }}>فروش</button>
      </div>

      <div className="grid grid-cols-2 gap-1 text-xs">
        {(["market", "limit"] as const).map((t) => (
          <button key={t} onClick={() => setType(t)} className="rounded-md py-1.5 capitalize"
            style={{ background: type === t ? "color-mix(in srgb, var(--bg) 40%, #fff 10%)" : "transparent", color: type === t ? "var(--ink)" : "var(--sub)" }}>
            {t === "market" ? "مارکت" : "لیمیت"}
          </button>
        ))}
      </div>

      {type === "limit" && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="mlabel">قیمت · USDT</span>
            {last > 0 && (
              <button className="font-mono text-[11px] tnum" style={{ color: "var(--brand)" }} onClick={() => setPrice((last / 100).toFixed(2))} dir="ltr">
                {fmtUsd(last)}
              </button>
            )}
          </div>
          <input className={input} style={{ borderColor: "var(--line)" }} inputMode="decimal" dir="ltr" placeholder="43000.00" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      )}

      <div>
        <span className="mlabel mb-1 block">مقدار · BTC</span>
        <input className={input} style={{ borderColor: "var(--line)" }} inputMode="decimal" dir="ltr" placeholder="0.0100" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>

      <div className="grid grid-cols-4 gap-1">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <button key={p} onClick={() => setPct(p)} className="rounded-md border py-1 font-mono text-[11px] tnum"
            style={{ borderColor: "var(--line)", color: "var(--sub)" }} dir="ltr">
            {p * 100}%
          </button>
        ))}
      </div>

      <motion.button whileTap={{ scale: 0.985 }} disabled={busy} onClick={submit}
        className="mt-0.5 rounded-lg py-2.5 text-sm font-bold text-[#0a0b0e] disabled:opacity-60" style={{ background: accent }}>
        {busy ? "…" : buy ? "خرید BTC" : "فروش BTC"}
      </motion.button>
      <div className="flex items-center justify-between text-[10px]">
        <span style={{ color: "var(--sub)" }}>موجودی: <span className="font-mono tnum" dir="ltr">{avail}</span></span>
        {msg && <span>{msg}</span>}
      </div>
    </div>
  );
}

function OpenOrders() {
  const { openOrders, api, refresh } = useApp();
  if (openOrders.length === 0) return null;
  return (
    <div className="mpanel p-2.5">
      <p className="mb-1 text-xs font-semibold opacity-70">سفارش‌های باز</p>
      <AnimatePresence initial={false}>
        {openOrders.map((o) => (
          <motion.div key={o.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 py-1 font-mono text-[11px] tnum" dir="ltr">
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
              style={{ color: o.side === "buy" ? UP : DOWN, background: o.side === "buy" ? "rgba(45,212,191,0.12)" : "rgba(251,113,133,0.12)" }}>
              {o.side}
            </span>
            <span>{fmtUsd(o.price)}</span>
            <span className="opacity-60">{fmtBtc(o.remaining)}</span>
            <button className="ms-auto rounded px-2 py-0.5 text-[10px]"
              style={{ background: "color-mix(in srgb, var(--bg) 40%, #fff 8%)" }}
              onClick={() => api(`/api/orders/${o.id}`, { method: "DELETE" }).then(refresh)}>
              لغو
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Fills() {
  const { fills } = useApp();
  if (fills.length === 0) return null;
  return (
    <div className="mpanel p-2.5">
      <p className="mb-1 text-xs font-semibold opacity-70">پر شدن‌های من</p>
      <AnimatePresence initial={false}>
        {fills.slice(0, 6).map((f) => (
          <motion.div key={f.at + f.price} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 py-0.5 font-mono text-[11px] tnum" dir="ltr">
            <span style={{ color: f.side === "buy" ? UP : DOWN }}>{f.side}</span>
            <span>{fmtBtc(f.qty)} BTC</span>
            <span className="opacity-60">@ {fmtUsd(f.price)}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
