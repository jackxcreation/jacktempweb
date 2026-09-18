# ✅ Production Go-Live Verification Checklist

Before routing live customer traffic to Jack Essentials, verify that all gate items are marked green:

### Security & Access Control
- [ ] IDOR/BOLA checks verified on `/orders/:id`, `/profile/:id`, `/returns/:id`, and `/tickets/:id`.
- [ ] OTP brute-force protection (`MAX_ATTEMPTS`, TTL expiry, resend cooldown) active.
- [ ] Production logs sanitized (no raw passwords, tokens, or Razorpay secrets printed).
- [ ] Security headers active via Helmet (CSP, HSTS, X-Content-Type-Options).

### Payments & Inventory
- [ ] Razorpay cryptographic signature verification (`crypto.createHmac`) fully tested.
- [ ] Webhook idempotency verified (preventing duplicate order creation on event retries).
- [ ] Atomic MongoDB transactions tested for checkout stock reduction.

### Testing & CI/CD
- [ ] GitHub CI workflow (`.github/workflows/ci.yml`) passing successfully (`npm ci`, `npm test`, `npm run test:e2e`).
- [ ] Playwright E2E suite passing across all customer journeys.
- [ ] Test artifacts (`test-results/`, `playwright-report/`) ignored in `.gitignore`.