import type { Metadata } from "next";
import Link from "next/link";
import LegalShell, { type LegalSection } from "@/components/legal/LegalShell";
import { getLegalBusiness } from "@/lib/legal/business";

export const metadata: Metadata = {
  title: "Privacy Policy · Add designer",
  description: "What the Add designer printing management app stores, why, and how long it is kept.",
};
export const dynamic = "force-dynamic";

const UPDATED = "22 October 2026";

export default async function PrivacyPage() {
  const b = await getLegalBusiness();
  const sections: LegalSection[] = [
    {
      id: "scope",
      title: "Who this covers",
      body: (
        <>
          <p>
            Add designer is an internal management application run by <strong>{b.name}</strong> for its own print shop. It is used by the
            shop&apos;s owner and staff to record print jobs, customer details, payments and daily takings. This policy explains what the
            application stores about the people who sign in (staff) and about the customers whose orders are recorded in it.
          </p>
          <p>The application is not offered to the public and does not sell, rent or trade personal data.</p>
        </>
      ),
    },
    {
      id: "data",
      title: "What we store",
      body: (
        <>
          <p><strong>Staff accounts.</strong> Name, email address, phone number (optional), role and a one-way hash of the password. Passwords are never stored in readable form.</p>
          <p><strong>Customers and jobs.</strong> The customer&apos;s name, phone number and, if given, email address; the job&apos;s category, specifications, dates, delivery location, price, advance and balance; and notes or attachments staff add to the job.</p>
          <p><strong>Ledger.</strong> Income and expense entries with amount, date, category, payment mode and an optional description or receipt image.</p>
          <p><strong>Activity.</strong> Who created or changed a job and when, so that work can be handed between staff and mistakes traced.</p>
          <p><strong>Notifications.</strong> If a staff member turns on push notifications, the browser&apos;s push subscription endpoint is stored so reminders can be delivered to that device.</p>
        </>
      ),
    },
    {
      id: "why",
      title: "Why we use it",
      body: (
        <ul>
          <li>To run the print shop: track every job from booking to delivery, bill customers and keep the daily ledger.</li>
          <li>To let staff sign in securely and see only what their role allows.</li>
          <li>To remind staff about overdue deliveries, pending payments and upcoming jobs.</li>
          <li>To generate invoices and exports the shop needs for its own accounts.</li>
        </ul>
      ),
    },
    {
      id: "cookies",
      title: "Cookies and storage on your device",
      body: (
        <>
          <p>The application uses no advertising or analytics cookies and no third-party trackers, so no cookie banner is shown. It stores only what it needs to work:</p>
          <ul>
            <li><strong>Session cookie</strong> (<code>next-auth.session-token</code>): keeps you signed in for up to 7 days. It is marked HttpOnly and Secure and holds no personal data beyond a signed reference to your account.</li>
            <li><strong>Sign-in security cookies</strong>: short-lived tokens that protect the sign-in form against forged requests.</li>
            <li><strong>Browser storage</strong>: small preferences such as whether the sidebar is collapsed and which reminders you dismissed today. These never leave your browser.</li>
          </ul>
          <p>Clearing your browser&apos;s site data removes all of the above and signs you out.</p>
        </>
      ),
    },
    {
      id: "google",
      title: "Google Drive",
      body: (
        <>
          <p>
            Staff can optionally connect their own Google account so that job files and receipts are saved to Google Drive. We request the
            <code> drive.file</code> scope only, which lets the application create and read the files and folders it created itself. It cannot see
            the rest of your Drive.
          </p>
          <p>The access and refresh tokens Google issues are stored on our server and used solely to upload and fetch those files on your behalf. You can disconnect Drive at any time from Settings → Google Drive, which deletes the stored tokens; you can also revoke access from your Google Account permissions page.</p>
          <p>
            Add designer&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
          </p>
        </>
      ),
    },
    {
      id: "sharing",
      title: "Who can see it",
      body: (
        <>
          <p>Data is visible only to signed-in staff, according to the permissions the owner assigns to each role. The owner can restrict staff from seeing amounts or from seeing jobs not assigned to them.</p>
          <p>We rely on a small number of service providers to run the application: a hosting platform that serves it, a managed PostgreSQL database that stores it, and Google when Drive is connected or a push notification is sent. Each processes data only to provide its service.</p>
          <p>We do not share personal data with anyone else unless the law requires it.</p>
        </>
      ),
    },
    {
      id: "retention",
      title: "How long we keep it",
      body: (
        <>
          <p>Job and ledger records are kept for as long as the shop needs them for its accounts. Deleted jobs and transactions move to a recycle bin and are permanently removed after <strong>30 days</strong>.</p>
          <p>Staff accounts are kept while the person works with the shop and are deactivated or deleted by the owner afterwards. Sign-in attempts are rate-limited using short-lived counters that expire within 15 minutes.</p>
        </>
      ),
    },
    {
      id: "security",
      title: "How we protect it",
      body: (
        <ul>
          <li>All traffic uses HTTPS; the application sends strict transport-security and content-type headers.</li>
          <li>Passwords are hashed with bcrypt and sign-in is rate-limited per account and per address.</li>
          <li>Every page and API checks the signed-in user&apos;s role before returning data.</li>
          <li>Temporary passwords issued for invitations or resets are single-use and expire.</li>
        </ul>
      ),
    },
    {
      id: "rights",
      title: "Your choices",
      body: (
        <>
          <p>Staff can update their own details from the account menu and turn push notifications on or off per device. Customers may ask the shop to see, correct or delete the details it holds about them; write to the email address below and we will respond within a reasonable time.</p>
          <p>If you believe data about you is being used wrongly, contact us first; you may also approach the relevant data protection authority in India.</p>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          When this policy changes we update the date at the top of this page. Material changes are also announced to signed-in staff.
          Our <Link href="/terms">Terms of Use</Link> describe the rules for using the application.
        </p>
      ),
    },
  ];

  return (
    <LegalShell
      eyebrow="Privacy policy"
      title="How Add designer handles your data"
      intro={<p>Plain language, no surprises: what the application stores about staff and customers, why it needs it, and how long it is kept.</p>}
      updated={UPDATED}
      sections={sections}
      business={b}
      otherHref="/terms"
      otherLabel="Terms of Use"
    />
  );
}
