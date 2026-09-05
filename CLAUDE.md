# tg-trade-miniapp

پله‌ی ۴ نردبان open source (نقشه: `~/projects/sowftware/LADDER-PLAN.md`) — «نامه‌ی اپلای به زبان کد»
برای گیتی‌نکست: مینی‌اپ تریدینگ تلگرام روی go-mini-exchange. **کیفیت repo خودِ محصول است.**

- Go: `export PATH=$HOME/sdk/go/bin:$PATH`. بک‌اند :8170 (`internal/tgauth` اعتبارسنجی initData —
  منطق امنیتی اصلی؛ تست‌هایش قرارداد است)، proxy allowlist به exchange :8140 با X-User از session.
  فرانت :3320 (RTL، فونت وزیرمتن، تم تلگرام، حالت dev مرورگری).
- اجرا: mini-exchange باید روی :8140 باشد → `TG_DEV_MODE=true go run ./cmd/server` و
  `npm run dev -- --port 3320`؛ برای محمد: http://100.106.1.79:3320 (Tailscale).
- برای دموی واقعی داخل تلگرام: BOT_TOKEN از BotFather + URL عمومی HTTPS (دستور در README) — کار محمد.
- دروازه‌ها: `go test ./... -race` + `npx tsc --noEmit`. هویت هرگز از کلاینت نمی‌آید — این قاعده شکستنی نیست.
