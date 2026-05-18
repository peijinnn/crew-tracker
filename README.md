# Crew Tracker — Setup Guide

A full-stack crew management system for event businesses.
Staff check in/out with live GPS. Admin manages crew, events, claims, and payroll.

---

## Step 1 — Set up Supabase (free database)

1. Go to https://supabase.com and create a free account
2. Click **New Project**, give it a name (e.g. "crew-tracker"), set a database password, choose a region (Singapore is closest for Malaysia)
3. Wait ~2 minutes for the project to spin up
4. Go to **SQL Editor** in the left sidebar
5. Paste the entire contents of `supabase-schema.sql` and click **Run**
6. Go to **Settings > API** and copy:
   - `Project URL` → your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → your `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Deploy to Vercel (free hosting)

### Option A: Deploy via GitHub (recommended)

1. Create a free account at https://github.com and https://vercel.com
2. Create a new GitHub repository and push this project folder:
   ```bash
   cd crew-tracker
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/crew-tracker.git
   git push -u origin main
   ```
3. Go to https://vercel.com/new → Import your GitHub repo
4. Vercel auto-detects Next.js — click **Deploy**

### Option B: Deploy via Vercel CLI

```bash
npm install -g vercel
cd crew-tracker
vercel
```

---

## Step 3 — Add environment variables in Vercel

After deploying, go to your Vercel project → **Settings > Environment Variables** and add:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `JWT_SECRET` | Any long random string (e.g. run `openssl rand -base64 32` in terminal) |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | *(Optional)* Google Maps API key for address lookup |

Then go to **Deployments** and click **Redeploy** to apply the variables.

---

## Step 4 — First login

Your app is now live at `https://your-project.vercel.app`

Default admin login (set in the SQL schema):
- **Email:** `admin@yourcompany.com`
- **Password:** `admin123`

⚠️ **Change this password immediately!** Go into Supabase > Table Editor > users and update the row, or add a "change password" API route.

To change the password, run this in Supabase SQL Editor (replace with a new bcrypt hash):
```sql
-- For a new password, generate a bcrypt hash at https://bcrypt-generator.com
UPDATE users SET password_hash = 'NEW_HASH_HERE' WHERE email = 'admin@yourcompany.com';
```

---

## Step 5 — Add staff and start using it

1. Log in as admin
2. Go to **Crew** tab → add each staff member with their name, email, password, and hourly rate
3. Go to **Events** tab → create events and assign crew
4. Share the URL with your staff — they log in with their email/password
5. Staff check in on their phone when they arrive at the event — their GPS location is recorded
6. Staff check out when done — hours calculated automatically
7. Staff submit claims for meal, transport, parking from the Claims tab
8. Admin approves claims and exports payroll CSV

---

## Features

### Staff view
- ✅ Check in to assigned events (GPS location captured)
- 🔴 Check out (GPS captured, hours auto-calculated)
- 🧾 Submit claims: meal, transport (RM 0.30/km return), parking, other
- 📋 View own history and claim statuses

### Admin view
- 📊 Dashboard: live check-ins, pending claims, total hours
- 👥 Crew management: add/remove staff with login credentials
- 📅 Events: create events, assign crew, set venue with GPS coordinates
- 🕐 Sessions: full log of all check-ins with location links
- 🧾 Claims: approve/reject/mark paid
- 💰 Payroll: wages + allowances breakdown, CSV export

---

## Customisation

**Transport rate** — change `TRANSPORT_RATE = 0.30` in `pages/staff.tsx` (line 6) and `pages/index.tsx`

**Crew roles** — edit the role options in `pages/admin.tsx` and `pages/staff.tsx`

**Meal amounts** — currently staff enter their own amount; you can pre-set a fixed rate by editing the claims form

**Custom domain** — in Vercel, go to Settings > Domains and add your own domain (e.g. crew.yourcompany.com)

---

## Tech stack
- **Next.js 14** — React framework, API routes
- **Supabase** — PostgreSQL database, hosted for free
- **Vercel** — hosting, free tier (100GB bandwidth/month)
- **bcryptjs** — password hashing
- **jsonwebtoken** — session tokens
