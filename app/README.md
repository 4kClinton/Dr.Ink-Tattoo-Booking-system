# Dr.Ink Tattoos — Booking System

Internal booking and records system for Dr.Ink Tattoos, built from `../RULES/` (PRD, TRD, UI/UX spec).
One artist, one manager. Clients never log in. **A booking only exists once a deposit is recorded.**

```
apps/
  web/            Next.js 16 (App Router) — staff dashboard + public token pages
  mobile/         Expo placeholder (v2)
packages/
  backend/        Convex — schema, all business logic, scheduler, SMS, HTTP webhooks
  shared/         zod schemas, M-Pesa parser, EAT time + money helpers, SMS templates
  ui-tokens/      design tokens (CSS variables + TS object for React Native)
```

All business rules live in Convex (`packages/backend/convex`). The web app is a thin client, so the
Expo app in v2 can reuse the same functions.

---

## Run it locally

Requirements: Node 22+, pnpm 10 (`corepack enable` or `npx pnpm@10`).

```bash
pnpm install

# 1. Backend. Either link a Convex account (recommended)…
pnpm dev:backend                 # npx convex dev: log in, create a project
# …or run a throwaway local backend with no account:
pnpm dev:backend:local

# 2. One-time: Convex Auth keys + public link base URL (in packages/backend)
cd packages/backend
pnpm setup:auth http://localhost:3000
npx convex env set PUBLIC_BASE_URL http://localhost:3000
cd ../..

# 3. Web. Point it at the deployment URL printed by step 1 (also in packages/backend/.env.local)
echo "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210" > apps/web/.env.local
pnpm dev:web                     # http://localhost:3000
```

**First run:** open `/sign-in`. The first account created becomes the **artist (owner)**, and the
studio is seeded with settings, T&Cs v1, the default SMS templates and Mon–Sat 10:00–19:00 hours.
Sign-up is then closed. Invite the manager from **Settings → Team & access** (see below).

**SMS in dev:** with no Africa's Talking credentials set, messages are logged to the Convex console and
marked `sent` (provider id `dev-…`). Nothing leaves the machine.

## Roles & access control

- **Artist (owner):** the first account created. Full access, always. There is only one.
- **Manager:** joins only through an invite link the artist creates in **Settings → Team & access**.
  The link is one-time, tied to the invited email, and expires after 7 days. It's sent by SMS, and
  can also be copied or shared on WhatsApp.
- The artist chooses what each manager can do, at invite time or any time later (**Manage access**).
  The permissions and their defaults are defined in `packages/shared/src/permissions.ts`:

  | Permission | Default for new managers |
  |---|---|
  | Create and reschedule bookings | on |
  | Cancel bookings and mark no-shows | on |
  | Double-book over another session | off |
  | Record payments | on |
  | Adjust final prices | on |
  | See revenue and reports (incl. lifetime spend) | off |
  | Export CSV files | off |
  | Edit client records | on |
  | Resend SMS | on |
  | Edit SMS templates | off |
  | Manage availability | off |

- **Never grantable (artist only):** team & access, deposit/policy/business settings, T&Cs,
  payment reversals, deposit decisions after studio cancellations, archiving or erasing clients,
  deleting photos.
- **Deactivate** signs a manager out everywhere immediately. **Issue temporary password** shows the
  artist a one-time password and forces the manager to choose a new one at next sign-in.
  Everyone can change their own password in **Settings → Your profile**.
- Every rule is enforced in the Convex functions (`requirePermission` in `convex/lib/auth.ts`);
  the UI only hides what you can't use. All access changes are in the audit log.

> Invite links use `PUBLIC_BASE_URL`. While that's `http://localhost:3000`, links only open on the
> computer running the app. Once deployed, set it to the real domain.

## Tests

```bash
pnpm test        # shared (Vitest) + backend (convex-test)
pnpm typecheck
```

- `packages/shared/test`: M-Pesa parser against real-shaped fixtures, deposit maths, quiet hours,
  EAT date maths, phone normalisation, overlap detection, template rendering, SMS segment counting.
  Add every new M-Pesa message format you receive to `test/fixtures/mpesa.ts`.
- `packages/backend/convex/tests`: the TRD §12 must-pass gates (underpaid deposit rejected, duplicate
  M-Pesa code rejected, manager blocked from artist-only functions, cancelled booking sends no
  reminders), plus overlap override, completion rule, reschedule limits, quiet hours, reversals,
  no-shows, consent tokens, and low-rating alerts.

---

## Environment variables

**Convex** (`npx convex env set …` in `packages/backend`):

| Var | Purpose |
|---|---|
| `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` | Convex Auth. Set by `pnpm setup:auth <site-url>` |
| `PUBLIC_BASE_URL` | Base for links in SMS, e.g. `https://book.drink.co.ke` |
| `AT_USERNAME`, `AT_API_KEY` (or `AFRICAS_TALKING_KEY`) | Africa's Talking app username + its API key. `AT_USERNAME=sandbox` uses the AT sandbox. Check the connection in **Settings → SMS** |
| `AT_SENDER_ID` | Alphanumeric sender (e.g. `DR_INK`) once Safaricom approves it; omit to use the shared shortcode |
| `SMS_WEBHOOK_SECRET` | Shared secret for the delivery-report webhook |

**Web** (`apps/web/.env.local` / Vercel): `NEXT_PUBLIC_CONVEX_URL`.

Secrets only ever live in Convex env vars, never in `NEXT_PUBLIC_*`.

## Deploy (Vercel + Convex Cloud)

1. `cd packages/backend && npx convex deploy`, then set the Convex env vars above on the **prod**
   deployment (`pnpm setup:auth https://your-domain` and the rest).
2. Vercel project → Root Directory `apps/web`. Build command:
   ```
   cd ../../packages/backend && npx convex deploy --cmd 'cd ../../apps/web && npx next build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
   ```
   Add `CONVEX_DEPLOY_KEY` (production deploy key) to Vercel env.
3. Africa's Talking dashboard → SMS delivery reports callback:
   `https://<your-deployment>.convex.site/sms/delivery?secret=<SMS_WEBHOOK_SECRET>`
4. `.github/workflows/ci.yml` runs typecheck → lint → tests on every push, and deploys on `main`
   (needs `CONVEX_DEPLOY_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets).

---

## What's built

All **P0** (v1.0) and most **P1** (v1.1) requirements:

| Area | Notes |
|---|---|
| Bookings (B-1…B-11) | 4-step sheet + review; deposit % snapshotted; deposit gate; overlap warn (artist override, manager blocked); reschedule with limit + forfeit flag; cancel (client = forfeit, studio = artist decides carry/refund); no-show (after start, auto-flags client); multi-session projects; source |
| Payments (P-1…P-7) | Paste-to-parse M-Pesa (code, amount, payer, time) with manual fallback; system-wide unique codes with live duplicate check; raw message stored; price adjustments with reason; completion only when paid ≥ final price **and** on/after the session day; immutable payments with artist-only reversing entries |
| Clients (C-1…C-6) | Phone (E.164) is the key, so any format reuses the client; search by name / phone / @IG; profile with tattoos, bookings, payments, consent, feedback, lifetime spend (artist only); flags; marketing opt-out; archive; KDPA erase |
| Tattoos (T-1…T-3) | Details, reference/final/healed photos (client-side compression, progress ring, 10 max); portfolio approval only with consent photo permission |
| Consent & terms (L-1…L-5) | Versioned markdown T&Cs; tokenised consent form (18+, health, aftercare, photos, KDPA data consent, typed signature); "Copy link" / "Open here" for the studio tablet |
| SMS (M-1…M-8, F-2) | Confirmation, reschedule, cancel, day-before reminder, artist morning digest (cron), aftercare + feedback, healed-photo, touch-up; editable templates with variable chips, live preview and segment counter; quiet hours; retry once then dashboard alert; manual resend; delivery-report webhook |
| Feedback (F-1, F-2) | 1–5 circles; 5 → Google review / Instagram buttons; ≤ 3 → SMS to artist |
| Availability (A-1…A-3) | Weekly hours, blocked dates, tour blocks (default booking location); calendar hatching |
| Dashboard & reports (R-1…R-6) | Today + Attention inbox; calendar agenda/day (mobile) and day/week/month (desktop) with now-line and tap-to-book; revenue, outstanding, no-show/cancellation rates, deposits retained, by location / source; CSV exports |
| Audit (AU-1, AU-2) | Every create/update/status change logged; booking History panel; managers can't delete |

### Deliberate deviations from the TRD

- **Password hashing** uses native Web Crypto PBKDF2-SHA256 (600k iterations) instead of Convex Auth's
  default JS Scrypt. Scrypt hit Convex's 1-second function limit during sign-in under load.
- **Rate limiting** of public token mutations (10/min/token) is a small fixed-window table
  (`convex/lib/rateLimit.ts`) instead of the `@convex-dev/rate-limiter` component. Same behaviour,
  no component wiring.
- **Completion** also requires the session day to have started, so a client who prepays in full can't
  trigger aftercare SMS before their session. The booking page shows "Complete session" on the day.
- **Auth routing** is client-side (`ConvexAuthProvider`). Every Convex function enforces roles itself,
  so there's no Next middleware.

### Before launch (from the specs, needs you)

- [ ] **Mokoto font:** add the licensed `Mokoto.woff2` at `apps/web/public/fonts/` and confirm the licence
      covers commercial web use. Until then, titles fall back to Open Sans heavy caps.
- [ ] **Logo:** the tile shows a text stand-in. Swap in the real mark in `components/ui/misc.tsx` (`LogoTile`).
- [ ] **Africa's Talking:** account owner, sender ID registration (1–2 weeks, KRA PIN / company docs).
- [ ] **Settings → Business:** real WhatsApp number, Google review link, Instagram handle.
- [ ] Review the default T&Cs and consent health questions (`packages/shared/src/constants.ts`).
- [ ] ODPC data-controller registration check (Kenya DPA).
- [ ] Test SMS on real Safaricom + Airtel lines; collect real M-Pesa messages as parser fixtures.
- [ ] Not yet wired: Sentry (needs a DSN), a Playwright E2E suite in CI, and password reset
      (the Convex Auth `reset` flow needs an email or SMS OTP provider).
