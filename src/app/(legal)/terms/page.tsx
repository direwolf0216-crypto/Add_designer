import type { Metadata } from "next";
import Link from "next/link";
import LegalShell, { type LegalSection } from "@/components/legal/LegalShell";
import { getLegalBusiness } from "@/lib/legal/business";

export const metadata: Metadata = {
  title: "Terms of Use · Add designer",
  description: "The rules for using the Add designer printing management app.",
};
export const dynamic = "force-dynamic";

const UPDATED = "22 October 2026";

export default async function TermsPage() {
  const b = await getLegalBusiness();
  const sections: LegalSection[] = [
    {
      id: "acceptance",
      title: "Using the application",
      body: (
        <p>
          Add designer is a private business tool provided by <strong>{b.name}</strong> to its owner, staff and invited collaborators. By signing in
          you agree to these terms and to the <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the application.
        </p>
      ),
    },
    {
      id: "accounts",
      title: "Accounts and passwords",
      body: (
        <ul>
          <li>Accounts are created by the owner by invitation. Each account is for one named person and must not be shared.</li>
          <li>Keep your password private. Set a new password as soon as you sign in with a temporary one.</li>
          <li>Tell the owner straight away if you think someone else has used your account.</li>
          <li>The owner may change a role, or suspend or remove an account, at any time.</li>
        </ul>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <>
          <p>Use the application only for the shop&apos;s work. In particular, do not:</p>
          <ul>
            <li>copy, export or share customer details, prices or ledger entries outside the business without the owner&apos;s permission;</li>
            <li>enter false records, or alter or delete records to hide a mistake;</li>
            <li>try to access jobs, amounts or settings your role does not allow, or interfere with the service&apos;s security;</li>
            <li>upload material you have no right to use, or anything unlawful or offensive.</li>
          </ul>
        </>
      ),
    },
    {
      id: "records",
      title: "Records and accuracy",
      body: (
        <>
          <p>Staff are responsible for the accuracy of what they enter. Amounts, dates and statuses recorded in the application are the shop&apos;s working records; the owner decides how they are used for billing and accounts.</p>
          <p>Deleted jobs and transactions stay in the recycle bin for 30 days and can be restored by the owner during that time. After that they are gone for good.</p>
        </>
      ),
    },
    {
      id: "integrations",
      title: "Google Drive and notifications",
      body: (
        <p>
          Connecting Google Drive and enabling push notifications are optional and under your control. Files saved to Drive sit in your own Google
          account and are subject to Google&apos;s terms. You can disconnect Drive or turn notifications off at any time from Settings.
        </p>
      ),
    },
    {
      id: "availability",
      title: "Availability and changes",
      body: (
        <p>
          We aim to keep the application available during working hours but it may be interrupted for maintenance or by events outside our control.
          Features may change as the shop&apos;s needs change. The application is provided as is, and to the extent the law allows, {b.name} is not
          liable for loss arising from its use or unavailability, beyond correcting the records concerned.
        </p>
      ),
    },
    {
      id: "law",
      title: "Governing law",
      body: (
        <p>
          These terms are governed by the laws of India. Any dispute will be handled by the courts having jurisdiction over Tenkasi district, Tamil Nadu.
          We may update these terms from time to time; the date at the top shows the current version.
        </p>
      ),
    },
  ];

  return (
    <LegalShell
      eyebrow="Terms of use"
      title="The rules for using Add designer"
      intro={<p>Short and practical: who may use the application, what you agree to when you sign in, and how records are handled.</p>}
      updated={UPDATED}
      sections={sections}
      business={b}
      otherHref="/privacy"
      otherLabel="Privacy Policy"
    />
  );
}
