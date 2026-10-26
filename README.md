# It Takes A Village

A shared caregiver log for tracking feeds, sleep, diapers, pumping, health, notes, and appointments. No login required — share a secret link with everyone helping care for your baby.

## Features

- **Quick logging** — Feed, sleep, diaper, and pump entries with modal forms
- **Live status** — See when baby last ate, slept, or had a diaper change
- **Due reminders** — In-app feed and medication due indicators (interval-based, no push required)
- **Weekly stats** — Feeds-per-day and sleep charts for the last 7 days
- **Data export** — CSV download, clipboard copy, and printable summary for pediatrician visits
- **Growth tracking** — Weight (kg), height (cm), and head circumference (cm) in one Growth log
- **Milestones** — Developmental checklist with custom milestones
- **Health tracking** — Temperature and medication (weight lives under Growth)
- **Handover notes** — Text notes with photo uploads
- **Appointments** — Upcoming pediatrician visits and vaccinations
- **Supply alerts** — Flag low supplies and mark as restocked
- **Diaper details** — Optional colour and consistency for dirty diapers
- **History** — 7-day activity timeline
- **Real-time** — Convex reactive queries keep all caregivers in sync
- **PWA** — Installable on mobile home screen
- **i18n** — English and 中文

Growth measurements (weight, height, head circumference) are logged only under **Profile → Growth**. Units are metric: **kg** and **cm**. Legacy inch values (if any) are converted ×2.54 on migration / display.

## Getting Started

```bash
npm install
npx convex dev   # in one terminal
npm run dev      # in another terminal
```

Open [http://localhost:3000](http://localhost:3000), create a tracker, and share the link with caregivers.

## Production

- **Live app:** https://it-takes-a-village.vercel.app
- **Convex:** https://zealous-hound-234.convex.cloud
- **Privacy policy:** https://it-takes-a-village.vercel.app/privacy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for env vars, deploy commands, and Vercel/GitHub setup.

### iOS App Store (Capacitor)

The iOS app wraps the production site in a Capacitor WebView (`com.ittakesavillage.app`). See **[IOS.md](./IOS.md)** for Xcode open/archive steps. Quick start:

```bash
npm run cap:sync
npm run cap:open:ios
```

## How memory works

Data is split between the Convex backend (shared, durable) and the browser (per-device convenience).

### Backend persistence (Convex)

All caregiver activity is stored in Convex and scoped by **tracker**. Each tracker is one family’s log:

- Feeds, sleep, diapers, pumps, health entries, notes, appointments, and supply alerts all include a `trackerId`
- Queries always filter by `trackerId`, so families never see each other’s data
- Returning to the same tracker URL (`/tracker/<secret-link>`) loads the full history for that family

### Device memory (localStorage)

On each device, the app remembers:

| Key | Purpose |
|-----|---------|
| `lastVisitedTracker` | Last tracker URL visited — powers **Continue with [baby name]** on the landing page |
| `caregiver:<secret-link>` | Which caregiver you selected, scoped per tracker (so multiple families on one phone don’t clash) |

Caregiver choice is **not** synced across devices; each caregiver picks their name when they open the link.

## Multiple families

Each **Create tracker** on the landing page creates a **new, isolated family**:

1. A unique 16-character secret link is generated (`nanoid`)
2. Optional baby name personalizes the tracker header (e.g. “Emma’s Village”)
3. Caregiver names are stored on that tracker only
4. Share the link only with people who should access that baby’s log

There is no account system. Isolation is by secret link: if you have the link, you have access to that family’s data.

### Security model (by design)

- **No login** — Access is gated by the unguessable secret link in the URL
- **Link = key** — Anyone with the link can read and write that tracker’s data
- **Do not share links publicly** — Treat them like passwords
- **Regenerate** — `trackers.regenerateSecret` can invalidate an old link if it leaks (UI for this can be added later)

> **Note:** Mutations accept a `trackerId` directly. In practice, clients only obtain `trackerId` after resolving a valid secret link. A party who already knows a `trackerId` could call the API without the link. For a no-login app, the secret link is the intended access boundary; stronger guarantees would require passing and verifying the secret on every mutation.

## Stack

- Next.js 16 + React 19
- Convex (backend + real-time)
- Tailwind CSS 4

## Reminders (in-app MVP)

Feed and medication reminders are **interval-based** and shown on the Home tab when approaching or overdue:

- Admins configure `feedIntervalHours` (default 2.5h) and optional medication schedules in **More → Reminders**
- Due times are computed from the last feed log or last matching medication entry
- Soft amber when within 30 minutes of due; soft red when overdue
- No push notifications in this MVP — caregivers see status when they open the app

### Future: Push notifications

To add Web Push later:

1. Register a service worker and request notification permission
2. Store push subscriptions per device in Convex
3. Run a Convex cron (`crons.interval`) that checks `reminders.getDueStatus` and sends notifications via a push service (e.g. web-push + VAPID keys)
4. Respect quiet hours and per-caregiver preferences

## Future: Sleep insights

The Stats page already shows **avg sleep per day** and **longest stretch (7 days)**. Additional ideas:

- **Average nap length by time of day** — bucket sleep entries into morning/afternoon/evening
- **Longest night stretch** — filter `type: "night"` sessions only
- **Wake windows** — time between end of last sleep and next sleep start
- **Trend lines** — week-over-week comparison

## Future: Diaper colour guidance

Optional colour and consistency fields are available when logging dirty diapers. Pediatrician flags to document in UI later:

- **Red** — possible blood; contact pediatrician
- **White/chalky** — possible bile duct issue
- **Persistent green** — may be normal for breastfed babies, but worth mentioning at visits
- **Black (after meconium)** — may indicate digested blood
