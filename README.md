# tg-trade-miniapp

A **Telegram mini-app for paper trading**, running on
[go-mini-exchange](https://github.com/mohammadzeyghami/go-mini-exchange):
open the bot inside Telegram, get paper funds automatically, trade BTC/USDT
against a live order book, and see your fills pushed in real time.

Next.js inside Telegram WebApp on the front; a small Go backend that does
the one thing that actually matters security-wise: **validating Telegram's
`initData` signature server-side** and never letting the client choose its
own identity.

![CI](https://github.com/mohammadzeyghami/tg-trade-miniapp/actions/workflows/ci.yml/badge.svg)

## Architecture

```
 Telegram app ──opens──► Next.js WebApp (:3320, RTL, Telegram theme vars)
                              │ POST /auth {initData}
                              ▼
                    Go backend (:8170)
                    1. HMAC-verify initData against BOT_TOKEN   ← the security
                    2. bound auth_date (replay window)             boundary
                    3. session token → identity  tg:<id>
                    4. faucet paper funds (idempotent)
                              │ X-User: tg:<id>   (allowlisted proxy)
                              ▼
                    go-mini-exchange (:8140) — engine, ledger, WS
                              ▲
              fills stream ───┘ (public WS; client filters its own)
```

## The security note (read this one section)

Everything a mini-app frontend sends is attacker-controlled — except
`initData`, which Telegram signs with a key derived from **your bot token**:

```
secret   = HMAC_SHA256(key="WebAppData", message=botToken)
expected = HMAC_SHA256(key=secret, message=sorted key=value lines minus "hash")
```

The backend recomputes that, compares in constant time, and bounds
`auth_date` (24h) against replay of captured payloads. Only then does a
session exist, and the trading identity (`tg:<id>`) is derived from the
**validated** payload — a client-supplied user id is never trusted anywhere.
The unit tests cover: valid payload accepted, tampered user id rejected,
wrong bot token rejected, stale `auth_date` rejected.

## Run it

```bash
# 1. the exchange this app trades on
git clone https://github.com/mohammadzeyghami/go-mini-exchange && (cd go-mini-exchange/backend && go run ./cmd/api)

# 2. this repo — dev mode first (no Telegram needed)
cd backend  && TG_DEV_MODE=true go run ./cmd/server        # :8170
cd frontend && npm i && npm run dev -- --port 3320         # :3320 in any browser
```

### Going live inside Telegram

1. **@BotFather** → `/newbot` → keep the token.
2. `/newapp` (or *Bot Settings → Configure Mini App*) → set the app URL to
   your deployed frontend (**must be public HTTPS** — deploy, or tunnel with
   `cloudflared tunnel --url http://localhost:3320` while developing).
3. Run the backend with `BOT_TOKEN=<token>` (and without `TG_DEV_MODE`).
4. Open the bot → the mini app button → trade. Haptic feedback on fills. 📱

## Decisions & trade-offs

| decision | why |
|---|---|
| Identity minted only from validated initData | the whole point; dev mode is explicit, opt-in, and clearly labeled in the UI |
| Backend as allowlisted proxy, not a general gateway | the exchange stays identity-blind (X-User), the mini-app owns authn — same split real platforms use |
| Faucet on every login | idempotent on the exchange's ledger (seed tx ids), so it's a no-op after the first time |
| Fills via the exchange's public WS, filtered client-side | fine for paper trading; a real system needs per-user channels — documented, not hidden |
| Sessions in memory | paper-trading demo; restart = relogin, which Telegram makes free |

## Deliberately out of scope

Real funds (obviously), per-user private WS channels, order history
pagination, bot commands/chat UX, multi-market UI.

## License

[MIT](LICENSE) · built with AI tooling under quality gates — see
[HOW-IT-WAS-BUILT.md](HOW-IT-WAS-BUILT.md).
