"use client";

import Link from "next/link";
import { Camera, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">AutoQC</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: April 24, 2026
          </p>
        </header>

        <div className="prose prose-invert max-w-none text-[15px] leading-relaxed space-y-8">
          <section>
            <p className="text-muted-foreground">
              AutoQC is operated by Staffify LLC (&quot;AutoQC,&quot; &quot;we,&quot; &quot;us&quot;). This policy explains what information we collect when you use the AutoQC web application at{" "}
              <Link href="/" className="text-foreground underline">
                autoqc.io
              </Link>
              , how we use it, who we share it with, and the choices you have. If you have any questions, email{" "}
              <a
                href="mailto:hello@autoqc.io"
                className="text-foreground underline"
              >
                hello@autoqc.io
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information we collect</h2>
            <p className="text-muted-foreground mb-3">
              We collect only the information needed to run the service.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Account information.</strong>{" "}
                Your email address, a hashed password (we use bcrypt; we never see the plaintext), your agency or business name, and your role on the agency.
              </li>
              <li>
                <strong className="text-foreground">Photos and property data.</strong>{" "}
                Images you upload (or that arrive from connected integrations like Dropbox), the property address or label you assign them, style profile settings, and any notes or tags you add.
              </li>
              <li>
                <strong className="text-foreground">Processing metadata.</strong>{" "}
                Quality-control scores, flagged issues, auto-fix actions, room-type classifications, and timestamps generated during QC.
              </li>
              <li>
                <strong className="text-foreground">Integration credentials.</strong>{" "}
                When you connect a third-party service (Dropbox, Aryeo, HDPhotoHub, Spiro, Tonomo), we store the access tokens or credentials needed to read and write on your behalf. These are stored server-side and never sent back to the browser.
              </li>
              <li>
                <strong className="text-foreground">Billing information.</strong>{" "}
                Payments are processed by Stripe. We store customer identifiers and a record of your purchases and credit transactions. Card numbers and bank details stay with Stripe; we do not see or store them.
              </li>
              <li>
                <strong className="text-foreground">Usage and log data.</strong>{" "}
                Our hosting provider (Vercel) records standard request logs (IP address, user agent, path, status). We use Vercel Analytics for aggregate page-view counts. We do not run advertising trackers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How we use your information</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Run QC on photos you upload and surface the results to you in the dashboard.</li>
              <li>Apply auto-fixes (vertical correction, color, sharpness, distraction removal on Premium) where configured.</li>
              <li>Deliver processed files to the integrations you connect.</li>
              <li>Charge for processing and manage your credit balance.</li>
              <li>Send transactional email (sign-in, password reset, purchase receipts, product announcements you opt into).</li>
              <li>Maintain security, prevent abuse, and improve accuracy of the QC engine.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We do not sell your data. We do not use your photos to train external foundation models. We do not share your photos with other customers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Sub-processors we use</h2>
            <p className="text-muted-foreground mb-3">
              To deliver the service, AutoQC shares limited data with the following service providers. Each acts under contract and for the purpose described.
            </p>
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground divide-y divide-white/5">
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Amazon Web Services</td>
                    <td className="px-4 py-2.5">Photo storage (S3), database (RDS), queue (SQS), compute (Lambda). US-East-1.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Vercel</td>
                    <td className="px-4 py-2.5">Web application hosting and aggregate analytics.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Anthropic</td>
                    <td className="px-4 py-2.5">Claude vision analysis for composition, room type, and distraction detection. Anthropic does not train on API inputs.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Replicate</td>
                    <td className="px-4 py-2.5">Hosted AI models for distraction inpainting and deblur on Premium properties.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Stripe</td>
                    <td className="px-4 py-2.5">Payment processing and card storage.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Resend</td>
                    <td className="px-4 py-2.5">Transactional email delivery (sign-in, password reset, receipts).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-foreground">Connected integrations</td>
                    <td className="px-4 py-2.5">
                      When you connect Dropbox, Aryeo, HDPhotoHub, Spiro, or Tonomo, AutoQC reads and writes only within the scope you authorize.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Security</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>All traffic between your browser, our servers, and our sub-processors is encrypted in transit with TLS.</li>
              <li>Photos in S3 and database rows in RDS are encrypted at rest.</li>
              <li>Passwords are hashed with bcrypt (cost 12); we cannot recover them and never see the plaintext.</li>
              <li>Integration access tokens and Dropbox app secrets are stored server-side and are never returned to the browser after being saved.</li>
              <li>Access to production systems is limited to personnel who need it to operate the service.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              No service is perfectly secure. If we ever learn of a breach that affects your data, we will notify you promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data retention</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>We retain your photos and property records for as long as your account is active.</li>
              <li>When you delete a property or photo, it is removed from the live database and scheduled for deletion from S3 within 30 days.</li>
              <li>When you close your account, we delete your photos, properties, and personal data within 30 days of the closure request, except where we are required to keep records (e.g., payment records retained for tax purposes).</li>
              <li>Aggregate, non-identifying metrics (e.g., total photos processed) may be kept indefinitely for operational analytics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your rights</h2>
            <p className="text-muted-foreground mb-3">
              You can:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Access, update, or export your account and property data from the dashboard.</li>
              <li>Disconnect any connected integration from the dashboard, which revokes our token and stops future syncing.</li>
              <li>Request deletion of your account and data by emailing{" "}
                <a href="mailto:hello@autoqc.io" className="text-foreground underline">hello@autoqc.io</a>
                .
              </li>
              <li>If you are in the EU, UK, or California, you have additional rights under GDPR / UK GDPR / CCPA including the right to access, correct, delete, and port your data, and to object to certain processing. Email the address above to exercise these rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Children</h2>
            <p className="text-muted-foreground">
              AutoQC is a business tool for photography agencies. It is not directed at children under 16, and we do not knowingly collect their personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to this policy</h2>
            <p className="text-muted-foreground">
              We may update this policy from time to time. Material changes will be announced by email or in-app notice at least 7 days before they take effect. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground">
              Staffify LLC<br />
              Email:{" "}
              <a href="mailto:hello@autoqc.io" className="text-foreground underline">
                hello@autoqc.io
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          &copy; {new Date().getFullYear()} AutoQC by Staffify LLC
        </Link>
      </footer>
    </div>
  );
}
