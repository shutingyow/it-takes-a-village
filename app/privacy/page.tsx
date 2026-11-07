import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — It Takes A Village",
  description:
    "How It Takes A Village handles baby care logs, sign-in, and device data under Singapore’s PDPA.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-full w-full max-w-2xl px-5 py-10 text-foreground">
      <p className="mb-6 text-sm text-muted">
        <Link href="/" className="text-primary underline-offset-2 hover:underline">
          ← Back to home
        </Link>
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted">Last updated: November 6, 2026</p>

      <div className="space-y-6 text-[15px] leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Who runs this app</h2>
          <p>
            It Takes A Village (“the App”) is operated by{" "}
            <strong>Shuting Yow</strong>, an individual based in Singapore
            (not a registered company). Contact for privacy matters:{" "}
            <a
              className="text-primary underline-offset-2 hover:underline"
              href="mailto:privacy@ittakesavillage.app"
            >
              privacy@ittakesavillage.app
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">What this app is</h2>
          <p>
            The App is a shared caregiver log for tracking baby care activities
            such as feeds, sleep, diapers, pumping, growth, health notes,
            moments, and related reminders. It is available on the web and as an
            iOS app that loads the same web service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Purpose of collection (PDPA)</h2>
          <p>We collect and use personal data only to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Provide the shared village log to caregivers you invite (timelines,
              summaries, photos, and sync)
            </li>
            <li>
              Let a signed-in owner create, claim, and manage villages, including
              in-app account deletion
            </li>
            <li>
              Power optional reminders, lock-screen Live Activities, and silent
              push that keeps those timers accurate across caregivers’ devices
            </li>
            <li>
              Diagnose crashes and fix reliability issues (error monitoring —
              see below)
            </li>
          </ul>
          <p>
            We do not sell personal data. We do not use care logs for advertising
            or cross-app tracking.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Data we store</h2>
          <p>Depending on how you use the App, we may store:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Baby profile details you enter (for example name, birth date, sex,
              and an optional profile photo)
            </li>
            <li>Caregiver display names and roles within a shared village</li>
            <li>
              Care logs and notes (feeds, nursing duration, bottles, solids,
              sleep, diapers, pump sessions, growth, health notes, milestones,
              moments, and photos you attach)
            </li>
            <li>Reminder and schedule preferences you configure</li>
            <li>
              A secret share link that unlocks a village — treat it like a
              password
            </li>
            <li>
              <strong>Sign-in data</strong> if you use Apple or Google: account
              identifiers from that provider (and, for some flows, email) so we
              can authenticate you as the village owner. Passwordless OAuth is
              handled by Apple/Google; we do not receive your Apple/Google
              password
            </li>
            <li>
              <strong>Device identifiers</strong> generated on your phone/browser
              to register push tokens for Live Activities and silent reminder
              sync (not used for advertising)
            </li>
            <li>
              <strong>Push / Live Activity tokens</strong> (Apple Push Notification
              service) so another caregiver’s log can update lock-screen timers
              or cancel stale local alerts
            </li>
            <li>
              Technical error reports if monitoring is enabled (see Error
              monitoring)
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Where data is stored</h2>
          <p>
            Application data and uploaded photos are stored with{" "}
            <strong>Convex</strong> (cloud backend). The production Convex
            deployment for this App is hosted in the{" "}
            <strong>United States</strong> (Convex Cloud). The web frontend is
            hosted on <strong>Vercel</strong>. Sign-in uses Convex Auth with
            Apple and Google as identity providers. If you use the App from
            Singapore, this means personal data may be transferred outside
            Singapore to those providers for the purposes above.
          </p>
          <p>
            Access to a village is controlled by the secret link (and, for owner
            actions, your signed-in account). Share the link only with trusted
            caregivers. Removing a caregiver does not by itself revoke the old
            link — regenerate the link when someone should lose access.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">How long we keep data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Village care logs and photos are kept until you delete individual
              entries, delete the village/account, or ask us to delete them
            </li>
            <li>
              Signed-in account records are kept until you delete your account
              in the App (Settings → Account → Delete account), which removes
              villages you own and related care data, then your auth records
            </li>
            <li>
              Device push / Live Activity registrations are removed when the
              related village is deleted, or when the device stops registering
            </li>
            <li>
              Error monitoring events (if enabled) are retained according to the
              monitoring provider’s retention settings (typically weeks to a few
              months) and are used only to fix the App
            </li>
            <li>
              Operational backups of the database (for disaster recovery) may
              retain a short rolling window of snapshots (see our operations
              notes); backups are not used for advertising
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Your rights and choices (PDPA)</h2>
          <p>You can:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Access and correct</strong> care data in the App by opening
              your village and editing entries, profile details, and caregiver
              list
            </li>
            <li>
              <strong>Delete</strong> individual entries (and their photos) in
              the App; owners can <strong>delete their account and owned
              villages</strong> in Settings → Account
            </li>
            <li>
              <strong>Rotate the village link</strong> after removing a caregiver
              so the old link stops working
            </li>
            <li>
              Turn off device reminders / Live Activities in Settings → Reminders
            </li>
            <li>
              Request access, correction, or deletion by emailing{" "}
              <a
                className="text-primary underline-offset-2 hover:underline"
                href="mailto:privacy@ittakesavillage.app"
              >
                privacy@ittakesavillage.app
              </a>{" "}
              if you cannot complete it in the App (for example, you no longer
              have the device). We aim to respond within 30 days
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Health-related information</h2>
          <p>
            Care logs can include feeding, sleep, growth, and health notes. This
            is family caregiving data, not a medical device or clinical record.
            Do not rely on the App as a substitute for professional medical
            advice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Error monitoring</h2>
          <p>
            We use <strong>Sentry</strong> (when configured) to capture
            application crashes and technical errors so we can fix bugs. Reports
            may include device/app version, rough timestamps, stack traces, and
            the page or screen where the error occurred. We configure monitoring
            to avoid intentionally sending care-log contents or photos. Sentry
            processes data as our processor for reliability only — not for ads
            or tracking across other companies’ apps.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">What Apple’s App Store listing shows</h2>
          <p>
            On the App Store, Apple’s privacy labels should match this policy.
            For It Takes A Village that means data linked to you (or your
            household’s village) for app functionality,{" "}
            <strong>not used for tracking</strong>:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Health &amp; Fitness (care logs you enter)</li>
            <li>Photos (optional attachments and profile photo)</li>
            <li>User ID (sign-in / account identifiers)</li>
            <li>Device ID (local device id for push / Live Activities)</li>
            <li>Crash Data (if Sentry is enabled)</li>
          </ul>
          <p>
            We do not use third-party advertising SDKs. See{" "}
            <code className="text-sm">IOS.md</code> in the project for the exact
            App Store Connect nutrition-label checklist used at submit time.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Children</h2>
          <p>
            The App is intended for adult caregivers logging care for a baby or
            child. It is not directed at children as end users.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Changes</h2>
          <p>
            We may update this policy as the App evolves. The “Last updated”
            date at the top will change when we do.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Contact</h2>
          <p>
            Privacy officer / contact: Shuting Yow —{" "}
            <a
              className="text-primary underline-offset-2 hover:underline"
              href="mailto:privacy@ittakesavillage.app"
            >
              privacy@ittakesavillage.app
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
