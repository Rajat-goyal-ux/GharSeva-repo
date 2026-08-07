# GharSeva

GharSeva connects nearby home owners and local service vendors by category and area. It includes bilingual Hindi/English UI, Google sign-in, vendor availability, job requests, ratings, recent activity and live location sharing.

## Stack

- Next.js App Router on Vercel
- Neon Postgres with Drizzle ORM
- Firebase Google Authentication
- Google AdSense

## Local setup

1. Copy `.env.example` to `.env.local` and fill the Firebase, AdSense and `DATABASE_URL` values.
2. Install packages with `npm ci`.
3. Apply database migrations with `npm run db:migrate`.
4. Start the app with `npm run dev`.

## Production

The Vercel project is linked to the GitHub `main` branch. Every pushed commit deploys automatically. `DATABASE_URL` is server-only; all Firebase and AdSense values prefixed with `NEXT_PUBLIC_` are public browser configuration.

Before using Google login on a new production hostname, add that hostname to Firebase Authentication's authorized domains.
