# The Lord Erroll · Guest Feedback

A QR-code guest feedback site and private owner portal for **The Lord Erroll Gourmet Restaurant**, 89 Ruaka Road, Nairobi.

- **Guest site** (`/feedback`): ten graceful screens, about a minute, English and Kiswahili, crown ratings, chips, staff recognition, voice-to-text, photos, recommendation score, optional contact details. A thank-you screen asks happy guests for a Google review and offers unhappy guests an apology and a follow-up promise.
- **Owner portal** (`/portal`): a live inbox with every submission (unread marked, urgent in crimson) and a full detail page. Includes status workflow, notes, assignment, star/pin, email and WhatsApp replies from templates, search and filters, and PDF/Excel/CSV export. Insights cover trends, sections, categories, occasions, a staff leaderboard, themes, sentiment, a word cloud and QR completion rates. Also: team roles, two-factor sign-in and an activity log.
- **Alerts:** an email for every submission with the full feedback, WhatsApp/SMS summaries, daily and weekly digests, and a monthly PDF report.
- **QR codes:** per-table and per-section codes, branded A6 table cards and bill-folder cards (HTML print and PDF), and a ZIP of everything.

**Start here: [SETUP.md](SETUP.md)** covers deployment, the owner account, QR printing and notifications.

```bash
npm install && cp .env.example .env   # fill in DATABASE_URL etc.
npx prisma migrate deploy && npm run db:seed-demo
npm run dev
```
# lord-erroll-feedback-platform
