# AmritaCollab
Equipment booking · faculty mentoring · team requests · resource sharing.
React + TypeScript · Vite · Tailwind · Lucide · Supabase (Postgres, Auth, Storage, RLS) · deploy on Vercel / Cloudflare Pages.

## Setup
1. Create a Supabase project. SQL Editor → run `supabase/schema.sql` (tables, RLS, RPCs, storage buckets, seed equipment + faculty).
2. `cp .env.example .env` and fill `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`
4. Students self-register. **Staff**: Dashboard → Authentication → Users → add user (Auto Confirm). Faculty must use the email stored in the `faculty` table. Then run `supabase/staff-setup.sql` (set the lab assistant's email in it).
5. Optional: Authentication → Providers → Email → turn off "Confirm email" for instant sign-up while testing.

## Deploy
- Vercel: import the GitHub repo, add the two env vars (`vercel.json` handles SPA routing).
- Cloudflare Pages: build `npm run build`, output `dist` (`public/_redirects` handles routing).

## Security model
Roles live in `profiles.role` (signup is always `student`; users cannot edit it). RLS: students see only their own bookings/requests; lab sees all bookings; faculty see only requests addressed to them. Slot double-booking is blocked by unique partial indexes; accept-team-role and offer-resource run as RPCs; contact emails are only revealed to people in the same team/offer. Decision emails are delivered to the in-app Inbox (realtime).
