import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — It Takes A Village",
  description:
    "Help and contact for It Takes A Village, the shared caregiver baby log.",
};

export default function SupportPage() {
  return (
    <main className="mx-auto min-h-full w-full max-w-2xl px-5 py-10 text-foreground">
      <p className="mb-6 text-sm text-muted">
        <Link href="/" className="text-primary underline-offset-2 hover:underline">
          ← Back to home
        </Link>
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Support</h1>
      <p className="mb-8 text-sm text-muted">It Takes A Village</p>

      <div className="space-y-6 text-[15px] leading-relaxed text-foreground/90">
        <section className="space-y-2">
          <h2 className="text-lg font-medium">What this app is</h2>
          <p>
            A shared log for caregivers — feeds, sleep, diapers, pumping,
            growth, and notes — so everyone helping with the baby stays in sync.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Getting started</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Parents / village owners</strong> sign in (Apple, Google,
              or email) to create a village, then share the link or QR with
              caregivers.
            </li>
            <li>
              <strong>Caregivers</strong> open the shared link. No account is
              required to log care.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Common questions</h2>
          <p>
            <strong>Can’t open the village?</strong> Check you have the latest
            shared link. If a caregiver was removed, the owner may have rotated
            the link — ask them for a new one.
          </p>
          <p>
            <strong>Sign-in stuck or wrong page?</strong> Close the sign-in
            sheet, return to the app, and try again on Wi‑Fi. Update to the
            latest TestFlight or App Store build if you have one.
          </p>
          <p>
            <strong>Something looks wrong in the log?</strong> Entries can be
            edited or deleted from the category screens (swipe on a row where
            that is offered).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Privacy</h2>
          <p>
            How we handle care logs and sign-in data:{" "}
            <Link
              href="/privacy"
              className="text-primary underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Contact</h2>
          <p>
            Operated by Shuting Yow (Singapore). For support or privacy
            questions, email{" "}
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
