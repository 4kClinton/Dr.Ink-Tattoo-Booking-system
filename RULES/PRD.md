# Dr.Ink Tattoos — Booking System
## Product Requirements Document (PRD)

| | |
|---|---|
| **Owner** | Clint (Artist / Owner) |
| **Version** | 1.0 — 14 Oct 2026 |
| **Status** | Draft for build |
| **Platforms** | Web (Next.js) now · Mobile app (Expo) later |

---

## 1. Summary

An internal booking and records system for Dr.Ink Tattoos. One artist, one manager. Clients are acquired through ads, posts and UGC on socials; they inquire by DM; the manager books them in. **A booking exists only after a deposit is paid.** The system confirms bookings by SMS, sends reminders and follow-ups automatically, and keeps every client, tattoo and payment record in one place.

This is an **operations tool, not a marketplace**. Clients never log in.

---

## 2. Goals & Non-Goals

### Goals
1. **Zero unpaid bookings on the calendar.** Deposit is a hard gate.
2. **No manual follow-up messaging.** Confirmations, reminders and post-session messages fire automatically.
3. **One source of truth** for clients, tattoos, payments, consent and feedback.
4. **Accurate revenue.** Deposit + balance tracked per booking; session is complete only when fully paid.
5. **Turn past clients into content and repeat business** (healed photos, reviews, touch-ups).

### Non-Goals (v1)
- Client self-booking or client accounts
- Lead / inquiry tracking (socials analytics cover this)
- Multi-artist support (data model keeps `artistId` so it isn't a rewrite later)
- In-app chat or WhatsApp Business API
- Automated M-Pesa API (Daraja) — manual verification against the business's own M-Pesa messages in v1

---

## 3. Users & Roles

| Role | Who | Can do |
|---|---|---|
| **Artist (Owner)** | Clint | Everything. Sets deposit %, policies, message templates, availability. Sees revenue reports. |
| **Manager** | Booking manager | Create / reschedule / cancel bookings, record payments, manage clients, view calendar, resend messages. **Cannot** change deposit %, policies, templates, or delete records. |
| **Client** | Tattoo customer | No login. Receives SMS. Opens tokenised links to: sign consent, view T&Cs, leave feedback. |

---

## 4. The Business Flow

```
Socials (ads / posts / UGC)
        │
        ▼
Client DMs → Manager agrees design, date, price
        │
        ▼
Client pays deposit (artist-set %, default 20%) via M-Pesa
        │
        ▼
Manager verifies against OUR received M-Pesa message → creates booking
        │
        ├──► SMS to client: confirmed + T&Cs link + consent link
        └──► SMS to artist: new booking
        │
        ▼
Day before ─► Reminder SMS (client + artist)
Day of     ─► Morning SMS to artist: today's sessions
        │
        ▼
Session ─► Balance paid (cash / M-Pesa) ─► Booking marked COMPLETE
        │
        ▼
Day +1  ─► Aftercare + feedback link
Week 3  ─► Healed-photo request (reply on WhatsApp via wa.me link)
Week 6  ─► Touch-up reminder (optional)
```

---

## 5. Functional Requirements

Priority: **P0** = launch blocker · **P1** = launch target · **P2** = after launch

### 5.1 Bookings

| ID | Requirement | P |
|---|---|---|
| B-1 | Manager creates a booking with: client, date, start time, estimated duration, location (Nairobi / Kericho / other), tattoo details, quoted price. | P0 |
| B-2 | Deposit amount is calculated from the quoted price × artist's deposit %. The % is **snapshotted onto the booking** at creation. | P0 |
| B-3 | **A booking cannot be saved without a deposit payment record** (M-Pesa code + amount). | P0 |
| B-4 | Deposit paid must be ≥ required deposit. Underpayment blocks save with a clear message. | P0 |
| B-5 | Prevent double-booking: warn when the new session overlaps an existing one. Artist can override; manager cannot. | P0 |
| B-6 | Statuses: `confirmed → completed`, or `confirmed → no_show`, `confirmed → cancelled`. Reschedule keeps status `confirmed` and logs the change. | P0 |
| B-7 | Reschedule: change date/time; previous reminders are cancelled and new ones scheduled; client and artist get a "rescheduled" SMS. | P0 |
| B-8 | Cancel / no-show: deposit is retained per non-refund policy. Reason required. | P0 |
| B-9 | Multi-session pieces: a booking can be linked to a parent "project" (e.g. sleeve, sessions 1 of 3). | P1 |
| B-10 | Booking source dropdown (IG ad, TikTok, UGC, referral, repeat, walk-in, other). Optional. | P1 |
| B-11 | Max reschedules per booking configurable (default 1) before deposit is forfeited. | P1 |

### 5.2 Payments

| ID | Requirement | P |
|---|---|---|
| P-1 | Record payments of type `deposit` or `balance`, method `mpesa` or `cash`. | P0 |
| P-2 | M-Pesa payments require the transaction code. **Codes are unique across the system** — a reused code is rejected. | P0 |
| P-3 | Manager can paste the full M-Pesa confirmation message; the system extracts code, amount, sender name/phone and timestamp, then shows them for confirmation. | P0 |
| P-4 | Store the raw pasted message as evidence. | P0 |
| P-5 | Final price can be adjusted at session end (designs grow). Change is logged with a reason. | P0 |
| P-6 | **A booking is marked `completed` only when total paid ≥ final price.** | P0 |
| P-7 | Payments are immutable. Corrections are made by a reversing entry (artist only). | P1 |

### 5.3 Clients

| ID | Requirement | P |
|---|---|---|
| C-1 | Client record: full name, phone (E.164, `+2547…`/`+2541…`), optional email, Instagram handle, date of birth, notes. | P0 |
| C-2 | Phone number is the unique key. Creating a booking for an existing phone reuses the client. | P0 |
| C-3 | Client profile shows all bookings, tattoos, payments, consent forms, feedback and lifetime spend. | P0 |
| C-4 | Search clients by name, phone or IG handle. | P0 |
| C-5 | Flag clients (e.g. "no-show history"); flagged clients show a warning when booked. | P1 |
| C-6 | Marketing opt-out flag. Opted-out clients get transactional SMS only (no touch-up / promo). | P1 |

### 5.4 Tattoo Records

| ID | Requirement | P |
|---|---|---|
| T-1 | Per booking: description, placement (body area), size (cm), style, colour (black & grey / colour), reference images. | P0 |
| T-2 | Upload final photo after session and healed photo later. | P1 |
| T-3 | Mark a photo "portfolio-approved" (client gave permission via consent form). | P1 |

### 5.5 Consent & Terms

| ID | Requirement | P |
|---|---|---|
| L-1 | Artist edits the Terms & Conditions (deposit non-refundable, reschedule rules, lateness). Versions are kept. | P0 |
| L-2 | Confirmation SMS includes a link to the T&Cs in force at booking time. | P0 |
| L-3 | Digital consent form via tokenised link: confirms 18+, health declarations, aftercare acknowledgement, photo-use permission, typed-name signature. | P0 |
| L-4 | Booking shows consent status. Unsigned consent shows a warning on the day; manager can collect it on a tablet at the studio. | P0 |
| L-5 | Data protection notice and consent to store personal data and photos (Kenya Data Protection Act 2019). | P0 |

### 5.6 Messaging (SMS)

| ID | Trigger | To | P |
|---|---|---|---|
| M-1 | Booking created | Client + Artist | P0 |
| M-2 | Booking rescheduled | Client + Artist | P0 |
| M-3 | Booking cancelled | Client + Artist | P0 |
| M-4 | Day before session (default 18:00 EAT) | Client + Artist | P0 |
| M-5 | Day of session (default 08:00 EAT) — artist's day summary | Artist | P1 |
| M-6 | Day +1 after completion — aftercare + feedback link | Client | P0 |
| M-7 | Week 3 — healed-photo request with `wa.me` link | Client | P1 |
| M-8 | Week 6 — touch-up reminder | Client | P2 |

Requirements:
- Templates editable by the artist, with variables (`{firstName}`, `{date}`, `{time}`, `{location}`, `{depositPaid}`, `{balance}`, `{link}`).
- Each send is logged with delivery status. Failed sends are retried once and surfaced on the dashboard.
- Manager can manually resend any message.
- No messages sent between 21:00 and 07:00 EAT (queued until 07:00).
- **WhatsApp is not required.** Replies route to the business WhatsApp via `wa.me/2547XXXXXXXX` links in the SMS.

### 5.7 Feedback

| ID | Requirement | P |
|---|---|---|
| F-1 | Tokenised feedback page: 1–5 rating + optional comment. | P0 |
| F-2 | Rating 5 → show buttons for Google review and Instagram tag. Rating ≤ 3 → notify artist. | P1 |

### 5.8 Availability

| ID | Requirement | P |
|---|---|---|
| A-1 | Weekly working hours. | P0 |
| A-2 | Blocked dates (off days, tour travel). | P0 |
| A-3 | Tour blocks: a date range tied to a location (e.g. Kericho, 3–7 Nov). Booking location defaults from tour block. | P1 |

### 5.9 Dashboard & Reports

| ID | Requirement | P |
|---|---|---|
| R-1 | Today view: sessions, consent status, balance due. | P0 |
| R-2 | Calendar: day / week / month. | P0 |
| R-3 | Revenue (artist only): deposits collected, balances collected, outstanding, by period. | P1 |
| R-4 | No-show and cancellation rate; deposits retained. | P1 |
| R-5 | Bookings by source and by location. | P2 |
| R-6 | CSV export of clients, bookings, payments (artist only). | P1 |

### 5.10 Audit

| ID | Requirement | P |
|---|---|---|
| AU-1 | Every create / update / status change logs who, what, when. | P0 |
| AU-2 | Nothing is hard-deleted by the manager. Artist can archive. | P0 |

---

## 6. Business Rules (single reference)

1. Deposit % is set by the artist (default **20%**) and snapshotted per booking.
2. No deposit → no booking.
3. Deposit is **non-refundable**. It is forfeited on no-show, on cancellation by the client, or after exceeding the reschedule limit.
4. If the **artist** cancels, the deposit is carried to a new date or refunded (artist decides; logged).
5. Session = complete only when the full final price is paid.
6. One M-Pesa transaction code can only ever be recorded once.
7. Clients must be 18+.
8. All times are Africa/Nairobi (EAT).

---

## 7. Success Metrics

| Metric | Target (3 months) |
|---|---|
| Bookings created with a verified deposit | 100% |
| Manual reminder messages sent by manager | 0 |
| No-show rate | < 5% |
| Consent signed before session | > 90% |
| Feedback response rate | > 30% |
| Healed photos collected | > 20% of completed sessions |
| Time to create a booking | < 90 seconds |

---

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Manager mis-types an M-Pesa code | Wrong payment trail | Paste-and-parse from our own M-Pesa message; unique code constraint |
| SMS delivery failure | Missed reminder → no-show | Delivery reports, retry, dashboard alert |
| Personal / body photo data leak | Legal + reputational | Role-based access, signed URLs, consent, KDPA compliance |
| Manager leaves | Knowledge loss | All context in system, not in personal WhatsApp |
| Scope creep into a marketplace | Delayed launch | Non-goals above are binding for v1 |

---

## 9. Release Plan

| Phase | Scope | Est. |
|---|---|---|
| **v1.0 — Launch** | All P0: bookings, payments, clients, tattoo records, consent, T&Cs, SMS M-1 to M-4 + M-6, feedback, calendar, audit | 3–4 weeks |
| **v1.1** | P1: multi-session projects, photos, tour blocks, revenue reports, healed-photo SMS, CSV export | +2 weeks |
| **v2** | Expo app for artist + manager; Daraja C2B auto-confirmation; P2 items | TBD |

---

## 10. Open Questions

1. Default reminder time: day before at 18:00 — confirm.
2. Reschedule limit before deposit is forfeited: 1? 2?
3. Is the 20% deposit calculated on the quote or a fixed minimum (e.g. KES 2,000) for small pieces?
4. Google Business profile link for reviews — exists yet?
5. Business WhatsApp number for `wa.me` links.
6. Who owns the Africa's Talking account and sender ID registration (needs KRA PIN / company docs; ~1–2 weeks lead time)?
