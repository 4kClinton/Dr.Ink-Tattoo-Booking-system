# Dr.Ink Tattoos — Booking System
## UI / UX Specification

| | |
|---|---|
| **Version** | 1.0 — 14 Oct 2026 |
| **Companion docs** | PRD.md, TRD.md |
| **Modes** | Light + Dark (system default, user toggle) |
| **Primary device** | Manager's phone (375–430px). Desktop is secondary. |

---

## 0. Design System

```
=================================================
DESIGN SYSTEM  x  Dr.Ink Booking
=================================================

STYLE       Dark OLED + Apple minimalism -- "studio calm"
MOOD        precise / confident / quiet
INSPIRED BY Linear (density + calm), Cash App (one bold accent on black),
            Apple Wallet (card hierarchy, money clarity)

COLORS (dark)
  Background     #000000  -- true black; matches logo, OLED-friendly
  Elevated       #0B0B0C  -- sidebar, tab bar
  Surface        #141416  -- cards, sheets
  Hover          #1C1C1F
  Border         #232326
  Text Primary   #F5F5F5  -- off-white, not #FFF (eye strain on black)
  Text Secondary #A1A1A6
  Accent         #DF2531  -- brand red; fills only (buttons, today marker)
  Accent Text    #F0454F  -- red for TEXT on dark (5.7:1); #DF2531 fails 4.5:1
  Success        #22C55E
  Warning        #F59E0B
  Destructive    see §0.3 -- deliberately NOT a second red

TYPOGRAPHY
  Display    Mokoto     700  / 28px (mob) 36px (desk) / ls +0.02em / UPPERCASE
  Heading    Open Sans  600  / 20px / lh 28 / ls -0.01em
  Subhead    Open Sans  600  / 16px / lh 24
  Body       Open Sans  400  / 15px / lh 24 (1.6)
  Label      Open Sans  500  / 13px / lh 18
  Caption    Open Sans  400  / 12px / lh 16
  Money      Open Sans  600  / tabular-nums

SPACING     8pt grid / 4 8 12 16 24 32 48 64 96
RADIUS      sm 8 / md 12 / lg 16 / xl 24 / full 9999
ELEVATION   flat in dark (borders + surface steps), subtle shadow in light
MOTION      spring stiffness 400 / damping 32 / micro 150ms / std 200ms / sheet 300ms

AVOID FOR THIS PRODUCT
  x  Red everywhere -- red is the brand; overuse makes every screen feel like an error
  x  Mokoto for anything but titles -- wide caps are unreadable in labels/data
  x  Neon glow effects -- the logo has one; the UI shouldn't compete with it
  x  Dense tables on mobile -- manager books on a phone mid-DM
=================================================
```

### 0.1 Palette mapping (from brand sheet)

| Brand swatch | Role in UI |
|---|---|
| `#000000` | Dark-mode background; light-mode primary text (as `#0A0A0A`) |
| `#FFFFFF` | Light-mode background; dark-mode text (as `#F5F5F5`) |
| `#DF2531` | Accent fill: primary buttons, active tab, "now" line, today badge |
| `#DF2531` @ 65% | Pressed state on accent buttons |
| `#DF2531` @ 45% | Selection / focus backgrounds — **use at 14% in practice**; 45% over black is muddy brown |

### 0.2 Contrast (WCAG AA verified)

| Pair | Ratio | Use |
|---|---|---|
| `#F5F5F5` on `#000000` | 19.3:1 | Body text dark |
| `#A1A1A6` on `#000000` | 8.0:1 | Secondary text dark |
| `#FFFFFF` on `#DF2531` | 4.7:1 | Text on red buttons ✅ |
| `#DF2531` on `#000000` | 4.4:1 | ❌ for body text — large/UI only |
| `#F0454F` on `#000000` | 5.7:1 | Red text in dark ✅ |
| `#DF2531` on `#FFFFFF` | 4.7:1 | Red text in light ✅ |
| `#5C5C61` on `#FFFFFF` | 6.7:1 | Secondary text light |

### 0.3 The red problem (critical decision)

Your brand colour **is** the universal error/destructive colour. If "Cancel booking" and "Create booking" are both red, the manager feels a low-level alarm on every screen.

**Rules:**
1. **Red = brand action**, never danger. Primary CTA, active nav, today marker. One red fill per screen, max.
2. **Destructive actions are neutral** (secondary button style) with an explicit verb ("Cancel booking", "Mark no-show") and always go through a confirmation sheet. The confirm button in that sheet uses an outlined red style + warning icon.
3. **Errors** always pair red text with the `AlertCircle` icon and a sentence. Colour is never the only signal.
4. **Money owed** uses Warning amber, not red.

---

## 1. Tokens (code)

```css
/* packages/ui-tokens/tokens.css */
:root, :root[data-theme="light"] {
  --bg:            #FFFFFF;
  --bg-elevated:   #F7F7F8;
  --surface:       #FFFFFF;
  --surface-hover: #F2F2F3;
  --border:        #E6E6E8;
  --border-strong: #D1D1D6;

  --text:          #0A0A0A;
  --text-2:        #5C5C61;
  --text-3:        #8E8E93;   /* non-essential only */

  --accent:        #DF2531;
  --accent-press:  rgba(223, 37, 49, 0.65);
  --accent-text:   #C81E2A;
  --accent-subtle: rgba(223, 37, 49, 0.08);
  --on-accent:     #FFFFFF;

  --success:       #16A34A;
  --success-subtle:rgba(22, 163, 74, 0.10);
  --warning:       #B45309;   /* darker amber for text contrast on white */
  --warning-subtle:rgba(245, 158, 11, 0.12);

  --shadow-card:   0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
  --shadow-sheet:  0 -8px 40px rgba(0,0,0,0.12);
  --focus-ring:    0 0 0 2px var(--bg), 0 0 0 4px var(--accent-text);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* same values as below */ }
}

:root[data-theme="dark"] {
  --bg:            #000000;
  --bg-elevated:   #0B0B0C;
  --surface:       #141416;
  --surface-hover: #1C1C1F;
  --border:        #232326;
  --border-strong: #2E2E33;

  --text:          #F5F5F5;
  --text-2:        #A1A1A6;
  --text-3:        #6E6E73;

  --accent:        #DF2531;
  --accent-press:  rgba(223, 37, 49, 0.65);
  --accent-text:   #F0454F;
  --accent-subtle: rgba(223, 37, 49, 0.14);
  --on-accent:     #FFFFFF;

  --success:       #22C55E;
  --success-subtle:rgba(34, 197, 94, 0.14);
  --warning:       #F59E0B;
  --warning-subtle:rgba(245, 158, 11, 0.14);

  --shadow-card:   none;        /* depth via surface steps + borders */
  --shadow-sheet:  0 -8px 40px rgba(0,0,0,0.6);
}
```

```css
/* Tailwind v4 */
@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-accent: var(--accent);
  /* …map every token… */
  --font-display: var(--font-mokoto);
  --font-sans: var(--font-open-sans);
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-xl: 24px;
}
```

### Fonts

```ts
// apps/web/app/fonts.ts
import { Open_Sans } from "next/font/google";
import localFont from "next/font/local";

export const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap" });
export const mokoto = localFont({ src: "./Mokoto.woff2", variable: "--font-mokoto", display: "swap" });
```

- **Mokoto is not on Google Fonts.** Self-host the `.woff2`, and check the licence covers web embedding for a commercial business before launch.
- Fallback for Mokoto: `"Open Sans", system-ui` at weight 800, uppercase.

### Theme switching

- `next-themes` with `attribute="data-theme"`, `defaultTheme="system"`.
- Toggle in Settings → Appearance: System / Light / Dark (segmented control).
- Inline script prevents a flash of the wrong theme on load.
- Logo: always shown on black. In light mode it sits in a `#000` rounded tile (radius-md) — don't recolour the logo.

---

## 2. Layout & Navigation

### Mobile (< 1024px) — primary

```
┌──────────────────────────────┐
│ ●  TODAY            [avatar] │  ← 56px header, Mokoto title
├──────────────────────────────┤
│                              │
│  content (16px side gutter)  │
│                              │
├──────────────────────────────┤
│ Today  Calendar  (+)  Clients  More │ ← 64px + safe-area
└──────────────────────────────┘
```

- Bottom tab bar on `--bg-elevated`, 1px top border.
- Centre **(+) New booking** is the only red element in the bar: 48px circle, `--accent`.
- Active tab: icon + label in `--text`; inactive `--text-3`. Small 4px red dot under active icon, not a red label.
- "More" opens a sheet: Messages, Reports (artist), Settings, Sign out.

### Desktop (≥ 1024px)

- Left sidebar 240px, `--bg-elevated`. Logo tile top-left.
- Content max-width 1200px, 32px padding.
- "New booking" becomes a primary button at the top of the sidebar; opens as a right-side panel (480px) instead of a full sheet.

---

## 3. Screens

### 3.1 Sign in
- Centered card (max 400px), logo tile, email + password, "Sign in" primary.
- Error: "That email and password don't match." (never reveal which field is wrong).

### 3.2 Today (home)

```
TODAY                         Wed 14 Oct
──────────────────────────────────────
┌ NOW ──────────────────────────────┐
│ 10:00 – 13:00 · Nairobi           │
│ Wanjiru K.                        │
│ Fine-line rose · left forearm     │
│ ✓ Consent   ⚠ KES 8,000 due       │
└───────────────────────────────────┘
  14:30 – 16:00 · Nairobi
  Brian O. · Script · ribs
  ⚠ Consent not signed   KES 6,400 due
──────────────────────────────────────
ATTENTION
  ⚠ 1 SMS failed — Brian O. reminder   [Resend]
  ○ 2 sessions yesterday not closed     [Review]
──────────────────────────────────────
THIS WEEK   6 sessions · KES 42,000 booked
```

- The **current/next** session card is elevated (surface + 1px `--accent` left border 3px). All others are plain rows.
- "Attention" section only renders if non-empty. It's the manager's inbox: failed SMS, unclosed past sessions (still `confirmed` after start time), missing consent for tomorrow.
- Empty state: "No sessions today." + secondary button "View calendar". No illustration.
- Week summary money line is artist-only.

### 3.3 Calendar

- **Mobile:** agenda list grouped by day (default) + horizontal 7-day date strip at top. Tap a date to jump. Day view on demand.
- **Desktop:** week grid (default), day, month.
- Session blocks: `--surface` fill, 3px left bar coloured by **location** (Nairobi = `--text`, Kericho = `--text-2` dashed). Status overlays:
  - Completed → check icon, 60% opacity
  - No-show → amber `UserX` icon
  - Cancelled → hidden by default (toggle "Show cancelled")
- Red 1px "now" line with 6px dot on today.
- Blocked time / tour blocks: diagonal hatched pattern in `--border`, label "Off" or "Kericho tour".
- Tap empty slot → New booking prefilled with date/time.

### 3.4 New booking (the critical flow)

Full-height bottom sheet on mobile (radius-xl top corners), side panel on desktop. **4 steps + review**, one stepper bar at top (4 segments, filled `--text`, current `--accent`).

**Step 1 — Client**
- Single field: "Phone or name". Searches as you type (debounced 200ms).
- Match → client row with last tattoo + flag warning if flagged.
- No match → inline expand: Full name, Phone (+254 prefix fixed, numeric keypad), Instagram (optional), Date of birth (optional).
- Phone formats accepted: `0712…`, `712…`, `+254712…` → normalised.

**Step 2 — Tattoo**
- Description (textarea, 2 rows), Placement (text + quick chips: Forearm, Upper arm, Chest, Back, Ribs, Thigh, Calf, Hand, Neck), Size W × H cm, Style chips, Colour segmented (Black & grey / Colour).
- Reference images: horizontal row of 72px thumbnails + "Add" tile. Upload progress ring on thumbnail.

**Step 3 — Schedule & price**
- Date picker (mobile: native-feeling wheel avoided; use a month grid sheet), Start time (15-min increments), Duration chips (1h, 2h, 3h, 4h, 6h, Custom).
- Location segmented: Nairobi / Kericho / Other. Defaults from tour block.
- Quoted price (KES, numeric keypad, thousands separator live).
- Live deposit line underneath, updating as they type:
  > Deposit required (20%) **KES 3,000**
- Overlap → inline amber warning card: "Overlaps Brian O. 14:30–16:00." Manager: must change time. Artist: "Book anyway" link.
- Source (optional) — collapsed under "More details".

**Step 4 — Deposit**
- Big textarea: **"Paste the M-Pesa message you received"**. Placeholder shows a sample.
- On paste → parse instantly → parsed card slides in:
  ```
  ✓ TJ4AB12XYZ
    KES 3,000 from JOHN DOE · 14 Oct, 3:41 PM
  ```
  Amount compared against required: green check if ≥, amber "KES 500 short" if less (blocks continue).
- Parse fails → "Couldn't read that message. Enter details manually." → Code + Amount fields appear.
- Duplicate code → error: "This M-Pesa code is already recorded on Wanjiru K.'s booking (12 Oct)." with link.
- Method toggle: M-Pesa (default) / Cash.

**Review**
- Summary card: client, tattoo one-liner, date/time/location, quote, deposit paid, balance.
- "Messages that will send": checklist preview — "Confirmation to client now", "Confirmation to you now", "Reminder Tue 18:00".
- Primary: **"Confirm booking"** (full width, red). Only enabled when deposit valid.

**After confirm:** sheet dismisses with spring; toast "Booking confirmed · SMS sent to Wanjiru". Calendar block animates in (scale 0.96 → 1, 200ms).

Target: **< 90 seconds** for a returning client.

### 3.5 Booking detail

```
← Back                         ⋯
WANJIRU K.                [Confirmed]
Thu 16 Oct · 10:00–13:00 · Nairobi
──────────────────────────────────
┌ PAYMENT ───────────────────────┐
│ Final price        KES 15,000  │
│ Paid               KES  3,000  │
│ ─────────────────────────────  │
│ Balance due        KES 12,000  │ ← amber
│ [ Record payment ]             │ ← primary
└────────────────────────────────┘
TATTOO
  Fine-line rose · left forearm, inner · 8×12 cm · Black & grey
  [img][img][img]
CONSENT      ⚠ Not signed   [Copy link] [Open here]
TERMS        v3 · sent 14 Oct
MESSAGES     timeline ▾
  ✓ Delivered  Confirmation · 14 Oct 15:42
  ◷ Scheduled  Reminder · 15 Oct 18:00
HISTORY      audit ▾
──────────────────────────────────
[ Reschedule ]  [ More ▾ ]  → Cancel booking · Mark no-show · Adjust price
```

- Status chip top-right (see §4.4).
- Phone number tap → actions: Call, SMS, WhatsApp (`wa.me`).
- "Open here" consent opens the consent form in-app for signing on the studio tablet.

### 3.6 Record payment (sheet)

- Same paste-to-parse component as Step 4, plus "Cash" toggle.
- Amount defaults to balance due.
- "Adjust final price" inline link above (reason required).
- If payment clears the balance → button label changes to **"Record & complete session"**.
- On complete: chip morphs Confirmed → Completed (success), subtle check animation (300ms spring), toast "Session complete · aftercare SMS goes out tomorrow 10:00".

### 3.7 Clients

- **List:** search bar sticky top; rows: name, phone, last visit, total sessions. Flag icon if flagged.
- **Profile:** header (name, phone actions, IG link), stats row (sessions · lifetime spend [artist only] · last visit), tabs: Tattoos (photo grid), Bookings, Payments, Consent, Feedback. Notes field editable inline.

### 3.8 Messages

- Filter chips: All · Scheduled · Delivered · Failed.
- Row: recipient, template name, time, status icon + label. Failed rows have "Resend".

### 3.9 Reports (artist only)

- Period segmented: This week / This month / Custom.
- 4 stat tiles: Collected · Outstanding · Sessions completed · No-show rate.
- Bar chart: collected per week (deposits vs balances stacked, `--text` and `--text-3` — **not red**).
- Breakdown lists: by location, by source.
- "Export CSV" secondary button.

### 3.10 Settings (artist only, except Appearance)

| Section | Contents |
|---|---|
| Deposits | Deposit % (stepper, 5–100), minimum deposit KES, reschedule limit |
| Terms & Conditions | Markdown editor + preview; "Publish v4" creates new version |
| Message templates | List; edit shows variable chips to insert, live preview with sample data, **character + SMS segment counter** ("142 / 160 · 1 SMS") turning amber past 160 |
| Schedule | Reminder time, artist digest time, quiet hours |
| Availability | Weekly hours grid, blocked dates, tour blocks |
| Business | WhatsApp number, Google review link, Instagram |
| Team | Staff list, invite manager, deactivate |
| Appearance | System / Light / Dark (all staff) |

### 3.11 Public pages (client-facing, no login)

Shared shell: black header band with logo (both modes), content on `--bg`, max-width 560px, follows system theme.

**Consent `/c/[token]`**
- "Hi Wanjiru — before your session on Thu 16 Oct, please confirm a few things."
- Sections as cards: Age (checkbox "I am 18 or older"), Health (yes/no toggles + "If yes, tell us more"), Aftercare acknowledgement, Photo permission (optional, clearly optional), Data consent (required, links privacy notice).
- Signature: "Type your full name" field, rendered below in a signature-style preview (Open Sans italic, not a fake script font).
- Submit → success screen: "You're all set. See you Thursday."
- Expired token: "This link has expired. Message us on WhatsApp." + wa.me button.

**Terms `/t/[token]`** — readable document, 65ch line length.

**Feedback `/f/[token]`**
- "How did it go?" — 5 large tappable circles 1–5 (48px), not stars (stars feel generic).
- Comment textarea.
- Rating 5 → "Thank you! Would you share it?" with two buttons: Google review, Tag @drink on Instagram.
- Rating ≤ 3 → "Thanks for being honest. Clint will reach out." (no review prompts).

---

## 4. Components

### 4.1 Button

| Variant | Light | Dark | Use |
|---|---|---|---|
| Primary | `--accent` fill, white text | same | One per screen |
| Secondary | `--surface` + 1px `--border-strong`, `--text` | same | Most actions |
| Ghost | transparent, `--text-2` | same | Tertiary |
| Danger-confirm | 1px `--accent-text` border, `--accent-text` text, `AlertTriangle` icon | same | Only inside confirmation sheets |

- Height 48 (mobile) / 40 (desktop), radius-md, Label 15px/600.
- States: hover (`--surface-hover` or accent at 90% brightness), pressed (scale 0.98 + `--accent-press`), focus (`--focus-ring`), disabled (40% opacity, `not-allowed`), loading (spinner replaces label, width locked).

### 4.2 Input

- Height 48, radius-md, `--surface`, 1px `--border`; focus → `--focus-ring`, border `--border-strong`.
- Label above (Label style), helper/error below (Caption). Error: icon + `--accent-text` text + border `--accent-text`.
- Money inputs: right-aligned, `KES` prefix in `--text-3`, tabular-nums, `inputmode="numeric"`.
- Phone: fixed `+254` prefix, `inputmode="tel"`.

### 4.3 Card
- `--surface`, radius-lg, padding 16 (mobile) / 24 (desktop), 1px `--border` in dark, `--shadow-card` in light.

### 4.4 Status chip

| Status | Style | Icon |
|---|---|---|
| Confirmed | `--surface-hover` bg, `--text` | `CalendarCheck` |
| Completed | `--success-subtle` bg, `--success` | `CheckCircle2` |
| No-show | `--warning-subtle` bg, `--warning` | `UserX` |
| Cancelled | transparent, `--text-3`, strikethrough | `XCircle` |
| Balance due | `--warning-subtle`, `--warning` | `Wallet` |
| Consent missing | `--warning-subtle`, `--warning` | `FileWarning` |

Height 24, radius-full, Label 12px/500, 8px horizontal padding. Icon + text always.

### 4.5 Bottom sheet
- Radius-xl top, drag handle (36×4, `--border-strong`), `--shadow-sheet`.
- Spring in (stiffness 400, damping 32), dismiss by drag > 30% or velocity.
- Backdrop: `rgba(0,0,0,0.5)` light / `0.7` dark.
- Focus trapped; `Esc` closes on desktop.

### 4.6 Toast
- Bottom-centre above tab bar, `--text` bg with `--bg` text (inverted), radius-md, 4s, optional "Undo" for reversible actions (e.g. resend).

### 4.7 Money text
- Always `KES 12,000` — space after KES, comma thousands, no decimals.
- Tabular-nums so columns align.

### 4.8 Skeleton
- `--surface-hover` blocks with 1.2s shimmer; disabled under reduced motion.

---

## 5. Interaction & Motion

| Interaction | Spec |
|---|---|
| Tap feedback | scale 0.98, 100ms |
| Hover | bg change, 150ms ease-out |
| Sheet / panel | spring 300ms |
| List item enter | fade + 4px rise, 200ms, 30ms stagger, max 6 items |
| Status change | chip cross-fade 200ms |
| Realtime update (other user changed something) | 1s `--accent-subtle` background pulse on the row |

All non-essential motion wrapped in `prefers-reduced-motion: no-preference`.

---

## 6. Content & Microcopy

- **Voice:** short, plain, calm. Sentence case everywhere except Mokoto titles.
- Name the person: "SMS sent to Wanjiru" not "Message sent successfully".
- Errors say what happened + what to do: "That M-Pesa code is already used on another booking. Check the message and try again."
- No exclamation marks in the staff UI. One allowed on client feedback success.
- Dates: `Thu 16 Oct`. Times: `10:00 AM` in client SMS (how clients read time), `10:00` 24h in the staff UI (denser, unambiguous).

### SMS templates (defaults, ≤ 160 chars)

| Key | Draft |
|---|---|
| `confirmed_client` | `Hi {firstName}, your Dr.Ink session is booked for {date} {time}, {location}. Deposit KES {deposit} received. Consent & terms: {link}` |
| `confirmed_artist` | `New booking: {clientName}, {date} {time}, {location}. {tattooShort}. Bal KES {balance}.` |
| `reminder_client` | `Reminder: Dr.Ink session tomorrow {time}, {location}. Eat well, hydrate, no alcohol. Questions? wa.me/{whatsapp}` |
| `aftercare_client` | `Hi {firstName}, how's the new ink healing? Keep it clean & moisturised. Tell us how it went: {link}` |
| `healed_client` | `Hi {firstName}! Your tattoo should be healed now. Send us a photo on WhatsApp: wa.me/{whatsapp}` |

---

## 7. Accessibility

- Touch targets ≥ 44×44 (tab bar items 64 tall).
- Visible custom focus ring on every interactive element.
- All status indicators = icon + text, never colour alone.
- Form fields have real `<label>`s; errors linked via `aria-describedby`.
- Sheets: `role="dialog"`, `aria-modal`, focus returns to trigger on close.
- Calendar grid navigable with arrow keys on desktop; agenda list on mobile is a plain list (screen-reader friendly).
- Image alt text: "{placement} tattoo reference {n}".
- Contrast pairs in §0.2.

---

## 8. Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| < 640 | Single column, bottom tabs, full-height sheets |
| 640–1023 | Single column, wider gutters (24), sheets max 640 centered |
| ≥ 1024 | Sidebar + content, side panels for create/edit, week calendar |

Test at **375px** first.

---

## 9. States Checklist (every screen)

- [ ] Loading (skeleton, not spinner, for lists)
- [ ] Empty (one sentence + one action)
- [ ] Error (inline, retry)
- [ ] Offline / reconnecting (thin amber bar under header: "Reconnecting…" — Convex handles sync)
- [ ] Permission-limited (manager sees nothing for artist-only data; no disabled ghosts)
- [ ] Light + dark both checked

---

## 10. Pre-Delivery Checklist

- [ ] Tokens only — no raw hex in components
- [ ] One red fill per screen max
- [ ] Mokoto only on page titles and logo lockups
- [ ] 8pt spacing throughout
- [ ] All interactive states (hover / focus / active / disabled / loading)
- [ ] Lucide icons only, no emoji
- [ ] Reduced-motion respected
- [ ] AA contrast in both modes
- [ ] Tested at 375px and on a real mid-range Android (Tecno/Infinix class)
- [ ] Mokoto licence confirmed for commercial web use
