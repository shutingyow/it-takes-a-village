# iOS App Store (Capacitor)

The iOS app is a **Capacitor WebView shell** that loads the production site:

**https://it-takes-a-village.vercel.app**

Web + Convex deploys update the live app without rebuilding the native binary.

| Item | Value |
|------|--------|
| **App name** | It Takes A Village |
| **Bundle ID** | `com.ittakesavillage.app` |
| **Xcode project** | `ios/App/App.xcodeproj` |
| **Privacy policy** | https://it-takes-a-village.vercel.app/privacy |
| **Config** | `capacitor.config.ts` |
| **Minimum iOS** | **17.0+** (Live Activities needs 16+; project targets 17) |

Apple Team ID / signing is configured in Xcode on your Mac — not stored in this repo.

## Sign-in (Convex Auth — Apple + Google)

Parents **sign in** to create a village. Caregivers still open the **secret link / QR** with no account.

| Piece | Detail |
|-------|--------|
| Backend | Convex Auth (`convex/auth.ts`) — Google + Apple OAuth |
| Callbacks | `{CONVEX_SITE_URL}/api/auth/callback/google` and `…/apple` |
| Site return | `SITE_URL` = `https://it-takes-a-village.vercel.app` (prod) or `http://localhost:3000` (dev) |
| Client | Home page SSO buttons; Capacitor loads the same web app |

### Dashboard setup (required before SSO works)

**`invalid_client` from Google/Apple** means Convex is missing or has the wrong `AUTH_*` env vars (or the OAuth redirect URI does not match). Production currently needs these set — JWT/`SITE_URL` alone is not enough.

**Production HTTP Actions base (callbacks):**  
`https://zealous-hound-234.convex.site`

| Provider | Redirect / Return URL |
|----------|------------------------|
| Google | `https://zealous-hound-234.convex.site/api/auth/callback/google` |
| Apple | `https://zealous-hound-234.convex.site/api/auth/callback/apple` |

1. **Google Cloud** → create **Web application** OAuth client  
   - Authorized JavaScript origins: `https://it-takes-a-village.vercel.app` (and `http://localhost:3000` for local)  
   - Authorized redirect URI: the Google row above (must be `.convex.site`, **not** `.cloud` and **not** your Vercel URL)  
   - Then:
     ```bash
     npx convex env set AUTH_GOOGLE_ID '<client-id>.apps.googleusercontent.com' --prod
     npx convex env set AUTH_GOOGLE_SECRET '<client-secret>' --prod
     ```
2. **Apple Developer** — App ID `com.ittakesavillage.app` + Sign in with Apple; **Services ID** (this is `AUTH_APPLE_ID`); Key `.p8` → generate JWT as `AUTH_APPLE_SECRET` ([guide](https://labs.convex.dev/auth/config/oauth/apple)). Return URL = Apple row above. Domains = `zealous-hound-234.convex.site`.
     ```bash
     npx convex env set AUTH_APPLE_ID '<Services-ID>' --prod
     npx convex env set AUTH_APPLE_SECRET '<jwt-secret>' --prod
     ```
3. **Convex** — also keep `SITE_URL=https://it-takes-a-village.vercel.app`, `JWT_PRIVATE_KEY`, `JWKS` (already set via `npx @convex-dev/auth --prod`).
4. **Local testing** — repeat the same `AUTH_*` sets **without** `--prod` (or use separate Google/Apple clients with local Convex `.site` callback). Local `SITE_URL` should be `http://localhost:3000`.
5. **Xcode** — App target → **Sign in with Apple** capability; rebuild after changing entitlements.

OAuth runs in the system browser against Convex callbacks, then returns to `SITE_URL`. After setting env vars, wait a few seconds and try sign-in again (no code redeploy required for env-only changes).

## Prerequisites (your Mac)

1. [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. **Xcode** from the Mac App Store (full Xcode, not only Command Line Tools)
3. Node.js + this repo’s `npm install`
4. CocoaPods / SPM: Capacitor 8 uses Swift Package Manager plugins; open Xcode and let packages resolve

## Open and run locally

```bash
cd /Users/shutingyow/it-takes-a-village
npm install
npm run cap:sync
npm run cap:open:ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities**
2. Choose your **Team** (personal or organization)
3. Confirm Bundle Identifier is `com.ittakesavillage.app`
4. Pick a simulator or device → **Run**

The WebView loads production HTTPS. Convex realtime works the same as in Safari.

### Open your existing web tracker (first launch)

The iOS app has **separate storage** from Safari, so it will not auto-open the tracker you used in the browser until you open it once:

1. On the home screen, under **Open your tracker**, paste your full tracker URL  
   (e.g. `https://it-takes-a-village.vercel.app/tracker/_qIvmhoCKkl31WB5`)  
   or just the secret code (`_qIvmhoCKkl31WB5`).
2. Tap **Open tracker** → pick your caregiver → you’re on the same live log.
3. Next launches on this phone show **Continue with …** for that tracker.

### Temporary local / tunnel testing

To point the shell at a local Next server instead of production:

1. Run `npm run dev` (and expose via LAN IP or ngrok if needed)
2. In `capacitor.config.ts`, temporarily set:

```ts
server: {
  url: "http://YOUR_LAN_IP:3000", // or https ngrok URL
  cleartext: true, // only for local http
},
```

3. Run `npm run cap:sync` and rebuild in Xcode  
4. **Revert** `server.url` to production and `cleartext: false` before App Store archive

## Regenerate icons / splash

Brand source: `public/app-icon-source.png` (1024×1024). Also copied into `assets/icon.png` for Capacitor.

Local notifications on iOS use the **app icon** (no custom `smallIcon` / `largeIcon` in `deviceNotifications.ts`). Updating the app icon therefore updates the notification icon after a native rebuild.

```bash
node scripts/generate-icons.mjs   # public/icon-192, icon-512, apple-touch-icon
# refresh assets/icon.png from app-icon-source, then:
cp public/app-icon-source.png assets/icon.png   # if assets/icon.png is stale
npm run cap:assets
npm run cap:sync
```

**You must rebuild from Xcode** (**Product → Clean Build Folder**, then **Run** / archive) for the home-screen and notification icons to update on a physical device. `cap:sync` alone does not replace an already-installed app icon on device.

## Local notifications + feed countdown (v1)

The web app schedules **on-device** feed / pump reminders via `@capacitor/local-notifications` when the user opts in under **Settings → Reminders**.

| Works today | Limitation |
|-------------|------------|
| Capacitor iOS app backgrounded (phone on, app not force-quit) | Local schedules are set from the client when the tracker is open |
| Lead-time alert (`notifyBeforeMinutes`) + countdown milestones at 60 / 45 / 30 / 15 min before next feed | Not a continuous ticking clock on the Lock Screen |
| Browser / Safari tab while page stays open | iOS Safari tabs are unreliable for background alerts |
| Reschedule when a feed/pump is logged (while app open) | |

**Apple Push (APNs) — not in v1.** True remote push when the app has been killed for days needs:

1. Apple Developer Push capability + APNs key/cert for `com.ittakesavillage.app`
2. A server (e.g. Convex action + cron) that knows next feed/pump due times and sends APNs
3. Device token registration from the Capacitor app

Local notifications typically do **not** require an `NS*UsageDescription` Info.plist string (unlike camera/photos). Remote push would use the Push Notifications capability in Xcode.

## Live Activities / Dynamic Island (Lock Screen countdown)

Native next-feed countdown is implemented in-repo (not Capgo — their plugin does not call ActivityKit yet):

| Piece | Location |
|-------|----------|
| Shared attributes | `ios/Packages/FeedCountdownShared` |
| Capacitor bridge | `ios/App/App/FeedLiveActivityPlugin.swift` (`FeedLiveActivity` JS plugin) |
| Widget / Dynamic Island UI | `ios/App/FeedLiveActivity/` |
| Web caller | `app/lib/feedLiveActivity.ts` (when device reminders are on) |

`Info.plist` has `NSSupportsLiveActivities = true`. Local notification milestones still fire as a fallback.

### Build / run on your iPhone

```bash
npm run cap:sync
npm run cap:open:ios
```

In Xcode:

1. Select the **App** scheme (not only the widget)
2. Confirm **App** and **FeedLiveActivityExtension** both link **FeedCountdownShared** (Package Dependencies)
3. Signing: same Team on App + extension; bundle IDs `com.ittakesavillage.app` and `com.ittakesavillage.app.FeedLiveActivity`
4. Deployment target **iOS 17.0+** for both
5. On the phone: **Settings → Face ID & Passcode / Live Activities** — allow for It Takes A Village
6. In the app: **Settings → Reminders** → enable device reminders, with a feed interval set (needs a recent feed so “next due” exists)
7. **Product → Clean Build Folder**, then **Run** — open the tracker, then lock the phone; you should see a ticking next-feed Live Activity

**Note:** The plugin is registered in `AppBridgeViewController` (not via `packageClassList`). After native changes you must rebuild from Xcode — a Vercel-only deploy will not pick up the bridge.

Web deploys update the WebView without a native rebuild, but **any change to the Widget Extension or `FeedLiveActivityPlugin` requires a new Xcode Run/Archive**.

## Info.plist privacy strings

`ios/App/App/Info.plist` already includes camera / photo library usage descriptions for entry photo attachments. If you add microphone or location later, add matching `NS*UsageDescription` keys before submit.

## Archive for App Store Connect

1. In Xcode: destination **Any iOS Device (arm64)**
2. **Product → Archive**
3. In Organizer: **Distribute App → App Store Connect**
4. Complete App Store Connect listing (see checklist below)

## App Store Connect checklist

You still need to create/configure these in [App Store Connect](https://appstoreconnect.apple.com):

- [ ] New app record with bundle ID `com.ittakesavillage.app`
- [ ] App name, subtitle, description, keywords
- [ ] Privacy Policy URL: `https://it-takes-a-village.vercel.app/privacy`
- [ ] **App Privacy** nutrition labels (baby care / health-related logs, photos if used)
- [ ] Age rating questionnaire
- [ ] Screenshots for required device sizes (iPhone 6.7", etc.)
- [ ] Support URL (can be the production site or a GitHub/README contact)
- [ ] Signing: distribution certificate + App Store provisioning profile (Xcode manages with automatic signing)

### Privacy nutrition label guidance (starting point)

This app stores caregiver-entered baby care data. Typical declarations:

| Category | Likely answer |
|----------|----------------|
| Health & Fitness / Other Health | Yes — linked to user / used for app functionality |
| Photos or Videos | Yes if users attach entry photos |
| Contact Info | Only if you later collect email/phone |
| Analytics / Tracking | No unless you add analytics SDKs |
| Advertising | No |

Review Apple’s labels against actual product behavior before submit.

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run cap:sync` | Copy config/www + update native iOS project |
| `npm run cap:open:ios` | Open `ios/App/App.xcodeproj` in Xcode |
| `npm run cap:assets` | Regenerate iOS icons/splash from `assets/` |

## Do not break web deploy

Capacitor files (`ios/`, `www/`, `capacitor.config.ts`, `assets/`) are separate from the Next.js Vercel build. They do not change how `npm run build` or Vercel production deploys work.
