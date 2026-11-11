# App Store Connect — listing pack

Paste-ready copy for **It Takes A Village**. Update screenshots from TestFlight while you test.

| Field | Value |
|-------|--------|
| **Bundle ID** | `com.ittakesavillage.app` |
| **App name** | It Takes A Village |
| **Privacy Policy URL** | https://takesavillage.co/privacy |
| **Support URL** | https://takesavillage.co/support |
| **Marketing URL** (optional) | https://takesavillage.co |

---

## Subtitle (30 characters max)

Shared baby care log

## Promotional text (170 characters max; editable anytime)

One shared log for everyone helping with the baby — feeds, sleep, diapers, and more. Caregivers use a link; no account required.

## Description

It Takes A Village is a shared caregiver log for the people looking after your baby.

Parents create a village and share a link or QR code. Caregivers open it and start logging — no sign-up needed for day-to-day care.

Log feeds, sleep (including live timers), diapers, pumping, growth, health notes, and small moments. Everyone sees the same timeline so handovers stay clear.

Built for real households: switch who you’re logging as, edit or delete entries, and keep reminders on track for feeds and pumps.

Privacy: care data stays in your village. We don’t sell it or use it for ads. Full details: https://takesavillage.co/privacy

Operated by Shuting Yow in Singapore.

## Keywords (100 characters max, comma-separated)

baby,caregiver,tracker,feed,sleep,diaper,pump,newborn,nanny,family

## What’s New (first public release)

First release. Shared logging for feeds, sleep, diapers, pumping, growth, and notes — with live sleep timers and caregiver-friendly links.

---

## App Privacy (nutrition labels)

Declare data **linked to the user**, used for **App Functionality**, **not used for tracking**:

| Data type | Collect? | Linked | Tracking | Notes |
|-----------|----------|--------|----------|-------|
| Health & Fitness | Yes | Yes | No | Feeds, sleep, diapers, pump, growth, health notes |
| Photos | Yes | Yes | No | Optional entry / profile photos |
| User ID | Yes | Yes | No | Apple/Google/email sign-in for owners |
| Device ID | Yes | Yes | No | APNs / Live Activities |
| Crash Data | Yes | Yes | No | Sentry stack traces; not care-log contents |
| Contact Info / Location / Advertising / Other Analytics | No | — | — | |

Native privacy manifest: `ios/App/App/PrivacyInfo.xcprivacy` (must stay aligned).

---

## Age rating (questionnaire hints)

- No unrestricted web browsing, gambling, or frequent mature themes.
- Medical/treatment information: infrequent / mild (growth, meds, health notes as caregiver logs — not a clinical device).
- User-generated content: care logs and optional photos within a private village.

Answer the ASC questionnaire honestly; adjust if Apple’s form wording differs.

---

## Screenshot shot list (capture on TestFlight)

Use a physical iPhone (6.7" required; add 6.5"/5.5" if ASC asks). Prefer clean demo data.

1. **Today** — home grid with age subtitle, a few recent cards  
2. **Sleep** — live nap in progress + **End sleep now** path visible if possible  
3. **Log** — feed or sleep bottom sheet mid-flow  
4. **Reports / Insights** — daily or weekly summary  
5. **Settings** — caregivers / signing in as owner (no secrets on screen)

Avoid real baby names/photos you don’t want public; use a demo village if needed.

---

## Submit checklist

- [ ] New TestFlight build with Google/Apple sign-in returning to the app (not stuck on Convex)
- [ ] Support URL live: https://takesavillage.co/support  
- [ ] Privacy URL live: https://takesavillage.co/privacy  
- [ ] App Privacy labels match table above  
- [ ] Screenshots uploaded  
- [ ] Review notes (optional): demo village link if Review needs one; explain caregivers use shared link without login  
