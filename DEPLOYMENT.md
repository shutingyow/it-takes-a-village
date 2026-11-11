# Deployment

Production URLs and environment setup for **It Takes A Village**.

## Production URLs

| Service | URL |
|---------|-----|
| **App (custom domain)** | https://takesavillage.co |
| **Support** | https://takesavillage.co/support |
| **Privacy** | https://takesavillage.co/privacy |
| **App (Vercel fallback)** | https://it-takes-a-village.vercel.app |
| **Convex HTTP / Auth (custom)** | https://api.takesavillage.co *(Pro custom domain; `CONVEX_SITE_URL` overridden)* |
| **Convex backend** | https://zealous-hound-234.convex.cloud |
| **Convex dashboard** | https://dashboard.convex.dev/d/zealous-hound-234 |

### Convex Auth custom domain (`api.takesavillage.co`)

**Live on production** for HTTP Actions / Convex Auth (`CONVEX_SITE_URL=https://api.takesavillage.co`). Frontend remains `SITE_URL=https://takesavillage.co`.

**GoDaddy DNS** (keep apex/`www` on Vercel):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | `api` | `convex.domains` | 1 hour |
| TXT | `_convex_domains.api` | `zealous-hound-234` | 1 hour |

**OAuth provider cutover (required once):**

1. Google Cloud OAuth client → Authorized redirect URI add:  
   `https://api.takesavillage.co/api/auth/callback/google`  
   Keep the old `zealous-hound-234.convex.site` URI until you confirm sign-in works, then remove it.
2. Apple Services ID → Return URL:  
   `https://api.takesavillage.co/api/auth/callback/apple`  
   Domains: `api.takesavillage.co`.

## Day boundary (summaries & Insights)

One **day** is a calendar day in **Asia/Singapore** (SGT, UTC+8):

| Bound | Wall clock | Inclusive? |
|-------|------------|------------|
| Start | `00:00:00.000` SGT | inclusive |
| End | next calendar day `00:00:00.000` SGT | exclusive |

Not a rolling 24-hour window. Home “today” cards, `dailySummary.getForDay`, and Insights Daily/Weekly stats all use this zone (same default as pump reminders). See `convex/lib/dayBounds.ts`.

## Environment variables

### Vercel (frontend)

Set in [Vercel project settings](https://vercel.com/shuting-yow-s-projects/it-takes-a-village/settings/environment-variables):

| Variable | Value | Environments |
|----------|-------|--------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://zealous-hound-234.convex.cloud` | Production, Development |

Preview deployments need a connected Git repository before branch-scoped preview env vars can be added.

### Local development

Copy `.env.example` to `.env.local` and run `npx convex dev` (not `convex deploy`):

```bash
cp .env.example .env.local
npx convex dev   # populates CONVEX_DEPLOYMENT and local URLs
npm run dev
```

Never commit `.env.local` — it is excluded via `.gitignore` (`*.env*`).

## Deploy commands

### Convex (production backend only)

```bash
npx convex deploy --yes
```

Use `npx convex dev` for local development. Do not use `convex deploy` during day-to-day dev work.

### Vercel (frontend)

```bash
# One-time: link project (already done for this repo)
vercel link

# Production deploy
vercel deploy --prod --yes
```

Or connect GitHub in the Vercel dashboard for automatic deploys on push.

## Verify build locally

```bash
NEXT_PUBLIC_CONVEX_URL=https://zealous-hound-234.convex.cloud npm run build
```

## GitHub

- **Repository:** https://github.com/shutingyow/it-takes-a-village
- **Default branch:** `master`

### Connect GitHub to Vercel (manual step)

The initial CLI deploy could not auto-link the GitHub repo. To enable preview/production deploys on push:

1. Open https://vercel.com/shuting-yow-s-projects/it-takes-a-village/settings/git
2. Connect `shutingyow/it-takes-a-village`
3. Set production branch to `master`
4. Add `NEXT_PUBLIC_CONVEX_URL` for **Preview** (all branches) with the production Convex URL above

## Push uncommitted work

Local changes are not yet on GitHub. When ready:

```bash
git add .
git commit -m "Your message"
git push origin master
```

## Privacy policy (App Store)

Public page for App Store Connect and users:

**https://takesavillage.co/privacy**

Source: `app/privacy/page.tsx`. Contact: `privacy@ittakesavillage.app` (Shuting Yow).

**Support URL (App Store):** https://takesavillage.co/support — source `app/support/page.tsx`.

**App Store listing pack:** see [STORE.md](./STORE.md) (description, keywords, privacy labels, screenshot shot list).

Custom domain DNS (GoDaddy): apex `A` → `76.76.21.21`; `www` `CNAME` → `cname.vercel-dns.com` (301 redirect to apex on Vercel).

### Convex backups (production)

1. Dashboard → production deployment → **Data → Backup & Restore** (or Settings → Snapshot export):  
   https://dashboard.convex.dev/t/shuting-yow/it-takes-a-village/zealous-hound-234  
2. **Turn on “Backup automatically”** (daily, include file storage) if your plan is **Convex Pro**. Free/Starter only keeps a couple of short-lived manual backups.  
3. Manual export anytime:  
   `npx convex export --prod --include-file-storage --path ~/Downloads/ittav-prod.zip`  
4. **Restore drill (do not restore over production):** create a disposable preview deployment, import the ZIP with `--replace`, confirm row counts, then delete/expire the preview.  
   Example already verified Nov 6, 2026: export → `preview/restore-drill` (`uncommon-kookabura-150`) restored **2495** documents + **8** files.

### Sentry

1. Org `yow-shuting`, project `it-takes-a-village` (already wired for production).  
2. Vercel (Production + Preview): `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Optional: `SENTRY_AUTH_TOKEN` for readable source maps.  
3. Without a DSN, the SDK stays inactive so local/build still works. Crash Data is declared in App Privacy / `PrivacyInfo.xcprivacy`.

## iOS App Store (Capacitor)

The native iOS shell loads the production Vercel URL in a WebView (no static export required for day-to-day web updates).

| Item | Value |
|------|--------|
| Bundle ID | `com.ittakesavillage.app` |
| App name | It Takes A Village |
| Config | `capacitor.config.ts` |
| Native project | `ios/` |

Full steps (Xcode open, archive, privacy labels, local tunnel testing): see **[IOS.md](./IOS.md)**.

```bash
npm run cap:sync
npm run cap:open:ios
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| App shows placeholder / no data | Confirm `NEXT_PUBLIC_CONVEX_URL` on Vercel matches production Convex URL; redeploy after changing env vars |
| `convex deploy` fails | Run `npx convex login` and ensure you have access to team `shuting-yow` |
| Vercel build fails | Run `npm run build` locally with `NEXT_PUBLIC_CONVEX_URL` set |
| Preview deploys missing env | Connect GitHub repo in Vercel, then add preview env var |
| iOS WebView blank / old site | Confirm `server.url` in `capacitor.config.ts` points at production; run `npm run cap:sync` and rebuild in Xcode |
