"use client";

// App context: Telegram WebApp bootstrap + session + live market data.
//
// Inside Telegram: window.Telegram.WebApp.initData is sent to the backend,
// which validates the signature server-side and returns a session token.
// In a plain browser (dev): a mock login (backend must run TG_DEV_MODE=true).

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// REST is same-origin, proxied to the mini-app backend by Next (next.config.ts),
// so the browser only talks to the web port — enough when a firewall/Tailscale
// ACL forwards the web port but not the API port. The exchange WS is a
// low-latency enhancement; when blocked, REST polling carries the UI.
const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const EXCHANGE_WS =
  process.env.NEXT_PUBLIC_EXCHANGE_WS ?? `ws://${host}:8140/ws`;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Telegram?: { WebApp?: any };
  }
}

export interface PriceLevel {
  price: number;
  qty: number;
}
export interface Order {
  id: string;
  userId: string;
  side: "buy" | "sell";
  price: number;
  qty: number;
  remaining: number;
  status: string;
}
export interface Fill {
  price: number;
  qty: number;
  side: "buy" | "sell";
  at: number;
}

interface AppState {
  ready: boolean;
  inTelegram: boolean;
  name: string;
  userId: string;
  authError: string;
  bids: PriceLevel[];
  asks: PriceLevel[];
  last: number;
  balances: Record<string, { available: number; hold: number }>;
  openOrders: Order[];
  fills: Fill[]; // my fills, newest first
  api: (path: string, init?: RequestInit) => Promise<Response>;
  refresh: () => void;
}

const Ctx = createContext<AppState | null>(null);
export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [authError, setAuthError] = useState("");
  const [inTelegram, setInTelegram] = useState(false);
  const [bids, setBids] = useState<PriceLevel[]>([]);
  const [asks, setAsks] = useState<PriceLevel[]>([]);
  const [last, setLast] = useState(0);
  const [balances, setBalances] = useState<AppState["balances"]>({});
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const tokenRef = useRef("");
  const userRef = useRef("");

  const api = (path: string, init?: RequestInit) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenRef.current}`,
        ...init?.headers,
      },
    });

  const refresh = () => {
    if (!tokenRef.current) return;
    api("/api/balances")
      .then((r) => r.json())
      .then(setBalances)
      .catch(() => {});
    api("/api/orders")
      .then((r) => r.json())
      .then(setOpenOrders)
      .catch(() => {});
  };

  // 1. auth
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const initData: string = tg?.initData ?? "";
    setInTelegram(Boolean(initData));
    tg?.ready?.();
    tg?.expand?.();

    const body = initData
      ? { initData }
      : { devUser: localStorage.getItem("miniapp-dev-user") ?? "mohammad" };
    fetch(`${API_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? `auth ${r.status}`);
        return r.json();
      })
      .then((res: { token: string; userId: string; name: string }) => {
        tokenRef.current = res.token;
        userRef.current = res.userId;
        setToken(res.token);
        setUserId(res.userId);
        setName(res.name);
      })
      .catch((e) => setAuthError(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. market data. Poll the proxied REST endpoints (same-origin → :8170 →
  // exchange) as the reliable path, since the exchange WS can be blocked by a
  // proxy/firewall; the WS below is a low-latency enhancement.
  useEffect(() => {
    if (!token) return;
    refresh();
    let wsLive = false;
    const poll = () => {
      if (wsLive) return;
      api("/api/orderbook")
        .then((r) => r.json())
        .then((ob: { depth?: { bids?: PriceLevel[]; asks?: PriceLevel[] }; last?: number }) => {
          setBids(ob.depth?.bids ?? []);
          setAsks(ob.depth?.asks ?? []);
          if (ob.last) setLast(ob.last);
        })
        .catch(() => {});
      refresh();
    };
    poll();
    const pollTimer = setInterval(poll, 1500);

    let ws: WebSocket | null = null;
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      ws = new WebSocket(EXCHANGE_WS);
      ws.onopen = () => {
        wsLive = true;
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as { type: string; data: any };
        if (msg.type === "depth") {
          setBids(msg.data.bids ?? []);
          setAsks(msg.data.asks ?? []);
        } else if (msg.type === "ticker") {
          setLast(msg.data.last ?? 0);
        } else if (msg.type === "trade") {
          const t = msg.data;
          const mine =
            t.buyerId === userRef.current || t.sellerId === userRef.current;
          if (mine) {
            const side = t.buyerId === userRef.current ? "buy" : "sell";
            setFills((f) =>
              [{ price: t.price, qty: t.qty, side, at: Date.now() } as Fill, ...f].slice(0, 20),
            );
            refresh();
          }
        } else if (msg.type === "order") {
          if (msg.data.userId === userRef.current) refresh();
        }
      };
      ws.onclose = () => {
        wsLive = false;
        if (!closed) timer = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(pollTimer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Ctx.Provider
      value={{
        ready: Boolean(token),
        inTelegram,
        name,
        userId,
        authError,
        bids,
        asks,
        last,
        balances,
        openOrders,
        fills,
        api,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const fmtUsd = (c: number) =>
  (c / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const fmtBtc = (s: number) =>
  (s / 1e8).toLocaleString("en-US", { maximumFractionDigits: 4 });
