# Fyrax website

Company portfolio site built with Next.js (App Router), Tailwind CSS and a small backend for the contact form (Prisma + SQLite).

## Getting started

```bash
npm install
cp .env.example .env   # then set ADMIN_PASSWORD and SESSION_SECRET
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

## Where things live

| What | Where |
|---|---|
| Company name, email, navigation | `src/content/site.ts` |
| Services | `src/content/services.ts` |
| Projects / case studies | `src/content/projects.ts` |
| Brand colours and fonts | `src/app/globals.css`, `src/app/layout.tsx` |
| Public pages | `src/app/(site)/` |
| Contact form backend | `src/app/(site)/contact/actions.ts` |
| Admin (read enquiries) | `src/app/admin/` |
| Database schema | `prisma/schema.prisma` |

## Contact enquiries

Messages sent through `/contact` are stored in the `ContactMessage` table.
Read them at `/admin/messages` — sign in with the `ADMIN_PASSWORD` from `.env`.

Each new enquiry is also emailed to the company inbox once `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set in `.env`.
The app password is a 16-character password created at https://myaccount.google.com/apppasswords (the Google account needs 2-Step Verification turned on). Replying to the notification replies to the visitor.

Spam protection: a hidden honeypot field and a limit of 5 messages per IP every 10 minutes.

## Scripts

- `npm run dev` — development server
- `npm run build` / `npm start` — production build and server
- `npm run lint` — ESLint
- `npm run db:migrate` — create/apply migrations in development
- `npm run db:deploy` — apply migrations in production
- `npm run db:studio` — browse the database

## Deployment

SQLite stores data in a file, so host the site somewhere with a persistent disk (a VPS, Railway, Render, Fly.io).
Set `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET` and `NEXT_PUBLIC_SITE_URL`, then run `npm run db:deploy && npm run build && npm start`.

For serverless hosts such as Vercel, switch the `datasource` provider in `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at a hosted Postgres database.
