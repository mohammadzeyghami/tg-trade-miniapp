# How this was built

With **Claude Code** implementing, against the mini-app chapter of the same
exchange-internals study plan as the rest of the ladder. The distinguishing
choices here:

1. **The auth boundary was written as a spec first** — Telegram's
   data-check-string algorithm, the derived-key HMAC, the replay window —
   and the tests construct *valid signed payloads themselves* (via the same
   `Sign` helper) so validation is exercised against real cryptography, not
   mocks: accept-valid, reject-tampered, reject-wrong-token, reject-stale.
2. **Dev mode is a first-class, honest feature** (`TG_DEV_MODE=true`), so
   the whole app runs and demos in a plain browser without a bot token —
   but it is opt-in, labeled in the UI, and cannot be reached in a
   production configuration.
3. **Quality gates:** `go vet` + `go test ./... -race`, `tsc --noEmit`,
   `next build`, then a live end-to-end run: dev login → idempotent faucet
   → market order through the proxy → fill visible under the session's
   identity on the exchange.
4. **Reviewed for the classic trap of this app class:** trusting any
   client-supplied identity. The proxy injects `X-User` exclusively from
   the server-side session; no client header survives the boundary.
