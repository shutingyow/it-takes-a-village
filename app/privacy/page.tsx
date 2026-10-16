import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — It Takes A Village",
  description:
    "How It Takes A Village handles baby care logs and caregiver data.",
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
      <p className="mb-8 text-sm text-muted">Last updated: October 7, 2026</p>

      <div className="space-y-6 text-[15px] leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-lg font-medium">What this app is</h2>
          <p>
            It Takes A Village (“the App”) is a shared caregiver log for tracking
            baby care activities such as feeds, sleep, diapers, pumping, growth,
            health notes, and related reminders. The App is available on the web
            and as an iOS app that loads the same web service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Data we store</h2>
          <p>Depending on how you use the App, we may store:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Baby profile details you enter (for example name and birth date)</li>
            <li>Caregiver display names and roles within a shared tracker</li>
            <li>
              Care logs and notes you create (feeds, sleep, diapers, pump sessions,
              growth, health, milestones, photos you attach, and similar entries)
            </li>
            <li>Reminder and schedule preferences you configure</li>
            <li>
              A secret share link that unlocks access to a tracker for caregivers
              who have the link
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">How data is used</h2>
          <p>
            Data is used only to provide the shared logging experience: showing
            timelines and summaries to caregivers who have the tracker link,
            syncing updates in near real time, and powering optional reminders.
            We do not sell personal data. We do not use care logs for advertising.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Where data is stored</h2>
          <p>
            Application data is stored using Convex (cloud backend). The web
            frontend is hosted on Vercel. Photos you attach may be stored through
            the App’s configured cloud storage for that feature. Access to a
            tracker is primarily controlled by possession of the secret link —
            treat that link like a password and share it only with trusted
            caregivers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Health-related information</h2>
          <p>
            Care logs can include information related to a child’s feeding,
            sleep, growth, and health notes. This is family caregiving data, not
            a medical device or clinical record. Do not rely on the App as a
            substitute for professional medical advice.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">iOS App Store privacy labels</h2>
          <p>
            When submitting the iOS app, App Store Connect privacy nutrition
            labels should reflect that the App may collect and link to the user
            data types you actually enable (for example Health &amp; Fitness /
            Other Health data for care logs, Photos if users attach images, and
            identifiers or usage data only if you add analytics later). Update
            the labels whenever product behavior changes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Your choices</h2>
          <p>
            Caregivers with access can edit or delete entries according to the
            App’s features. If you need a tracker or account data removed, contact
            the operator using the email below. Anyone with the secret link can
            view that tracker’s data until access is rotated or the tracker is
            deleted.
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
            We may update this policy as the App evolves. The “Last updated” date
            at the top will change when we do.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Contact</h2>
          <p>
            Questions about privacy:{" "}
            <a
              className="text-primary underline-offset-2 hover:underline"
              href="mailto:privacy@ittakesavillage.app"
            >
              privacy@ittakesavillage.app
            </a>
            . Replace this address with a monitored inbox before App Store
            review if needed.
          </p>
        </section>
      </div>
    </main>
  );
}
