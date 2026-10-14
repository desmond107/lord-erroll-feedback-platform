# Setup guide — Lord Erroll Feedback

Guest feedback site (`/feedback`) and private owner portal (`/portal`) for The Lord Erroll Gourmet Restaurant, 89 Ruaka Road, Nairobi.

**Stack:** Next.js 15 (App Router) + Tailwind CSS 4 · PostgreSQL via Prisma · Resend (email) · WhatsApp Cloud API and Africa's Talking (alerts, optional) · pdf-lib / ExcelJS / qrcode / JSZip.

---

## ⚠️ Before go-live: confirm these details

| Item | Status |
|---|---|
| **Owner notification email** | Set to `s@lorderrll.com`, as supplied. The domain looks like a typo of `lord-erroll.com`. Please confirm, because every alert goes here. |
| **Owner WhatsApp number** | The value supplied was an email address (`reservations@lord-erroll.com`). WhatsApp and SMS alerts need a phone number in `OWNER_ALERT_PHONE`, e.g. `254721920820`. |
| **Google review link** | Blank. Until `GOOGLE_REVIEW_URL` is set, happy guests are sent to a Google Maps search for the restaurant. Get the real link from Google Business Profile → *Ask for reviews*. |
| **Table numbers** | The default plan is a placeholder: Bar side 1–8, West Wing 9–20, East Wing 21–32, Clairmont side 33–40. Correct it under **Portal → QR codes** *before* printing cards. |
| **"Clairmont side"** | Spelling taken from the brief. Edit `src/lib/config.ts` if it should differ. |

---

## 1. Run it locally

```bash
npm install
cp .env.example .env            # then fill in DATABASE_URL, DATABASE_URL_UNPOOLED, AUTH_SECRET, CRON_SECRET
npx prisma migrate deploy       # create tables
npm run db:seed                 # default table plan
npm run db:seed-demo            # OPTIONAL: ~200 sample feedback items + demo logins
npm run dev                     # http://localhost:3000/feedback and /portal
```

Demo logins (password `LordErroll-demo-2026`): `owner@demo.lord-erroll.local`, `manager@demo.lord-erroll.local` and `supervisor@demo.lord-erroll.local`. **Before launch, remove all demo data:** `npm run db:clear-demo`. This deletes only flagged demo items and accounts; real guest feedback is never touched.

`npm run smoke` runs 16 end-to-end checks against a running server: submission, spam traps, duplicates, scans, access control and cron. Set `BASE=https://…` to test a deployment. Its test items are flagged as demo data.

## 2. Deploy

**Recommended: Vercel + Supabase (or Neon).**

1. Create a Postgres database. On Supabase, use the **session pooler** connection string (port 5432).
2. Import the project into Vercel and add every variable from `.env.example` in *Project → Settings → Environment Variables*:
   - `APP_URL`: the public address, e.g. `https://feedback.lord-erroll.com`. **QR codes are built from this, so set it before printing.**
   - `AUTH_SECRET`: `openssl rand -base64 48`
   - `CRON_SECRET`: `openssl rand -hex 24`
3. `vercel.json` already sets the build command to `prisma migrate deploy && npm run build`, so every deploy applies new migrations. Deploy.
4. Point a subdomain (e.g. `feedback.lord-erroll.com`) at Vercel in your DNS.
5. `vercel.json` already schedules the digests at 08:00 Nairobi time: daily, Monday (weekly) and the 1st (monthly). Vercel sends `CRON_SECRET` automatically.

**Self-hosting** on any Node 20+ server works too: `npm run build && npm start` behind Nginx/Caddy with HTTPS. Add crontab entries for the digests:

```cron
0 5 * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://feedback.lord-erroll.com/api/cron/digest?kind=daily
0 5 * * 1  curl -s -H "Authorization: Bearer $CRON_SECRET" https://feedback.lord-erroll.com/api/cron/digest?kind=weekly
0 5 1 * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://feedback.lord-erroll.com/api/cron/digest?kind=monthly
```

The proxy must set `X-Forwarded-For` (Vercel does). Rate limiting reads the guest's IP from it.

## 3. Create the owner account

```bash
npm run owner:create -- --email s@lorderrll.com --name "Owner's Name"
```

This prints a temporary password. Sign in at `/portal/login`, then under **Settings**:

- change the password;
- **turn on two-factor authentication** (any authenticator app);
- choose which digests to receive.

Add managers and supervisors under **Team**. Each new member gets a temporary password to pass on privately.

| Role | Can do |
|---|---|
| Owner | Everything, including Team and the Activity log |
| Manager | View, reply to guests, change status, notes, assign, star/pin, export, edit tables |
| Supervisor | View feedback and insights only |

## 4. QR codes and table cards

1. Set `APP_URL` to the live address and correct the table plan under **Portal → QR codes**.
2. Print from the same page:
   - **Print table cards**: A6 cards, four per A4 sheet, with crest, gold border and the "Share your experience" wording.
   - **Bill-folder cards**: 85 × 55 mm, ten per sheet, for bill folders and menus.
   - **Download all (ZIP)**: every code as 1200 px PNG and vector SVG, both card sheets as print-ready PDFs, and `index.csv`.
3. Print at **100% scale** on 300 gsm ivory card and cut on the dashed lines. Scan a few codes with a phone before printing the full batch.

Each table's code opens `/feedback?section=west-wing&table=12`, which pre-fills the seating area and table. A section-only code (no table) suits the bar counter and lounge. Scans are counted once per phone per table per day. The completion rate (submissions ÷ scans) shows on the QR and Insights pages.

`npm run qr:zip` builds the same ZIP from the command line into `qr-export/`.

## 5. Notifications

Every submission is **saved first**, then the alerts go out. No feedback is lost if a channel is down. Every attempt is recorded in **Settings → Delivery log**, and failed instant alerts have a **Retry** button.

| Channel | Variables | Sends |
|---|---|---|
| **Email (Resend)** | `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_NOTIFY_EMAILS` | The full feedback for every submission. Ratings of 1–3 are flagged URGENT in crimson. Replying to the email goes to the guest when they left an address. |
| **WhatsApp** | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE`, `OWNER_ALERT_PHONE` | A one-line summary with a link, for every submission. |
| **SMS (Africa's Talking)** | `AT_USERNAME`, `AT_API_KEY`, optional `AT_SENDER_ID` | The same summary for urgent items only. Set `SMS_ALERTS=all` to send for every submission. |
| Portal | — | A live inbox that checks every 10 s, with a toast, a chime and an optional desktop notification. |

- **Resend:** create an account, verify `lord-erroll.com` (add the DNS records it shows), create an API key, and set `EMAIL_FROM="The Lord Erroll <feedback@lord-erroll.com>"`.
- **WhatsApp Cloud API:** in Meta Business Manager, add a phone number to a WhatsApp Business app and create a *utility* template named `new_feedback_alert` (language English). Give it one body variable, for example: `New guest feedback at The Lord Erroll: {{1}}`. Messages only send once Meta approves the template.
- **Africa's Talking:** use `AT_USERNAME=sandbox` while testing. Register a sender ID for production.
- Use **Settings → Notifications → "Send me a sample now"** to preview each digest. The monthly report attaches a PDF with the crest in the header.

Until a channel is configured its alerts show as *skipped*. The portal still works fully.

## 6. Backups and data

- **Managed Postgres:** turn on daily backups / point-in-time recovery in Supabase or Neon.
- **Extra copies:** `npm run backup` writes a `pg_dump` (`.sql.gz`) and a portable JSON export (photos included, password hashes excluded) into `backups/`, keeping the last 30. Run it from cron on any machine that can reach the database, and copy the folder off-site.
- Guest photos are compressed on the phone (≤1600 px), checked on the server, stored in Postgres, and served only to signed-in staff.
- IP addresses are never stored, only a salted hash used for rate limiting. Two-factor secrets are encrypted at rest.

## 7. Guest-site protections

- **Spam:** a hidden honeypot field, a minimum completion time, and a per-connection rate limit (40 per hour, generous because restaurant Wi-Fi shares one IP).
- **Bots:** Cloudflare Turnstile checks every submission once `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set (free at dash.cloudflare.com → Turnstile, widget mode *Managed*). It's invisible to almost every guest. Without it, a script can file fake 1-star reviews, and each one triggers a paid SMS alert. Set both keys before go-live. `NEXT_PUBLIC_…` is built into the page, so redeploy after adding it.
- **Duplicates:** each submission carries a unique ID, so retries can't double-post. Identical content from the same connection within 15 minutes is ignored. A phone that already submitted from a table in the last 3 hours is gently told so, with a "different visit" option.
- **Saved progress:** answers are saved on the phone as the guest goes and restored if they return within 12 hours.
- **Slow connections:** the form is a single light page (about 120 kB of JavaScript) and photos are downscaled before upload. If the connection drops at submit, the feedback is kept on the phone and sent automatically when it reconnects.
- English and Kiswahili, chosen automatically from the phone's language with a toggle. Voice-to-text where the browser supports it (Chrome and Safari). Dark mode follows the phone's setting.

## 8. Where things live

| Want to change… | Edit |
|---|---|
| Sections, occasions, chips, rating labels, restaurant details | `src/lib/config.ts` |
| Guest wording (EN/SW) | `src/lib/i18n.ts` |
| Reply templates | `src/lib/reply-templates.ts` |
| Notification emails | `src/lib/emails.ts` |
| QR card wording | `src/lib/qr-cards.ts` (`CARD_COPY`) |
| Colours and fonts | `src/app/globals.css` |
