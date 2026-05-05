import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Leadstaq",
  description: "The terms governing your use of Leadstaq.",
};

const LAST_UPDATED = "29 April 2026";

export default function TermsOfServicePage() {
  return (
    <>
      <h1 className="mb-3 font-serif text-4xl tracking-tight text-ink-primary md:text-5xl">
        Terms of Service
      </h1>
      <p className="mb-12 font-mono text-sm uppercase tracking-[0.1em] text-ink-tertiary">
        Last updated · {LAST_UPDATED}
      </p>

      <p className="mb-8 text-base leading-relaxed text-ink-secondary">
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Leadstaq (the &quot;Service&quot;),
        operated by Adlense Network (&quot;Leadstaq&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By creating an
        account or using the Service, you agree to these Terms.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        1. The Service
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Leadstaq is a software platform that helps marketing agencies generate, distribute, and
        manage sales leads on behalf of their clients. The Service includes landing page hosting,
        lead capture forms, integrations with advertising and messaging platforms, pipeline
        tracking, and reporting tools.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        2. Eligibility
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        You must be at least 18 years old and authorized to enter into binding contracts on behalf
        of any business or organization you represent. By using the Service, you confirm both.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        3. Accounts
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        You are responsible for maintaining the confidentiality of your account credentials and for
        all activity under your account. Notify us immediately at{" "}
        <span className="rounded bg-surface-card-alt px-1.5 py-0.5 font-mono text-sm">
          legal@leadstaq.tech
        </span>{" "}
        if you suspect unauthorized access.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Account creation is by invitation. Agencies create accounts for their clients and
        salespeople. Self-signup may be enabled in future; current Terms apply regardless of
        creation method.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        4. Acceptable use
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">You agree NOT to:</p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>Use the Service for any illegal, fraudulent, or harmful purpose.</li>
        <li>
          Send unsolicited messages (spam) via WhatsApp, email, or any channel using the Service.
        </li>
        <li>
          Collect data through deceptive forms or without proper consent from data subjects.
        </li>
        <li>
          Violate any third-party rights, including intellectual property and privacy rights.
        </li>
        <li>
          Reverse-engineer, copy, or attempt to extract source code from the Service.
        </li>
        <li>Circumvent security features, rate limits, or access controls.</li>
        <li>
          Resell, sublicense, or otherwise commercially exploit the Service without our written
          consent.
        </li>
        <li>
          Use the Service in a way that violates Meta&apos;s, WhatsApp&apos;s, or any other integrated
          platform&apos;s terms.
        </li>
        <li>Upload viruses, malware, or content intended to disrupt the Service.</li>
        <li>Impersonate another person or business.</li>
      </ul>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We may suspend or terminate accounts that violate these rules, with or without notice
        depending on severity.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        5. Plans and billing
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Specific pricing, billing cycles, and payment terms are governed by the service agreement
        signed between Leadstaq (or the Agency operating Leadstaq) and the paying party. Where
        there is no separate agreement, plan details visible on our pricing page apply.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        All fees are quoted in United States Dollars (USD) unless otherwise specified. Invoices are
        issued per the agreed billing schedule. Late payments may result in service suspension as
        detailed in your service agreement.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Advertising spend (e.g., Facebook ad budget) is paid by you directly to the relevant
        platform and is not part of Leadstaq&apos;s fees.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        6. Your content
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        You retain ownership of content you upload to the Service (logos, branding assets, lead
        data, written copy, etc.). By uploading, you grant Leadstaq a non-exclusive, worldwide
        license to host, process, and display the content solely as needed to provide the Service.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        You are responsible for ensuring you have the rights to upload and use any content. We may
        remove content that we believe violates these Terms, the rights of others, or applicable
        law.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        7. Our content
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        The Leadstaq platform — including our software, design, templates, branding, documentation,
        and features — is owned by us and protected by intellectual property laws. We grant you a
        limited, non-exclusive, non-transferable license to use the Service while your account is
        active and your fees are current.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Landing page templates included in the Service may be used for landing pages within the
        Service but may not be extracted, redistributed, or used outside Leadstaq.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        8. Third-party integrations
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        The Service integrates with third-party platforms including Meta (Facebook, WhatsApp),
        Twilio, SendGrid, Supabase, and others. Your use of those integrations is subject to their
        respective terms. We are not responsible for the availability, accuracy, or behavior of
        third-party services.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        If a third-party platform suspends, restricts, or changes its services in a way that
        affects Leadstaq, we will work to restore functionality but cannot guarantee uninterrupted
        access.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        9. Service availability
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We aim for high availability but do not guarantee uninterrupted service. Scheduled
        maintenance, third-party outages, and unforeseen incidents may affect access. We are not
        liable for downtime caused by factors outside our reasonable control.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        10. No guarantee of results
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Leadstaq provides tools to capture and manage leads. We do not guarantee any specific
        outcome — including but not limited to a particular volume of leads, conversion rates,
        customer acquisition, or revenue. Results depend on factors including ad spend, market
        conditions, sales team performance, and many variables outside our control.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        11. Termination
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        You may stop using the Service at any time. Specific cancellation terms (notice periods,
        final invoice timing, data export) are governed by your service agreement.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We may suspend or terminate your access immediately if you breach these Terms, fail to pay
        fees, or use the Service in a way that risks harm to us or others. Upon termination, your
        access ends, and data is handled per the retention policy in our Privacy Policy.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        12. Disclaimers
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express
        or implied, including warranties of merchantability, fitness for a particular purpose, and
        non-infringement, except where such disclaimers are prohibited by law.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        13. Limitation of liability
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        To the maximum extent permitted by law:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          We are not liable for indirect, incidental, consequential, or punitive damages —
          including lost profits, lost revenue, lost data, or business interruption.
        </li>
        <li>
          Our total aggregate liability for any claims arising from these Terms or your use of the
          Service is limited to the fees you paid us in the three (3) months preceding the event
          giving rise to the claim, or USD 100, whichever is greater.
        </li>
        <li>
          We are not liable for actions or omissions of third-party platforms (Meta, Twilio, etc.).
        </li>
      </ul>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        14. Indemnification
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        You agree to indemnify and hold harmless Leadstaq, its directors, employees, and agents
        from any claims, damages, or expenses (including reasonable legal fees) arising from your
        use of the Service, your violation of these Terms, or your violation of any third-party
        rights.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        15. Governing law and disputes
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        These Terms are governed by the laws of Zimbabwe. Disputes will first be addressed through
        good-faith negotiation for at least 30 days. If unresolved, disputes will be referred to
        arbitration in Harare, Zimbabwe, or to the courts of Zimbabwe.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        16. Changes to these Terms
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We may update these Terms from time to time. Material changes will be communicated by email
        or via a notice in the Service. Continued use of the Service after the effective date of
        changes constitutes acceptance.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        17. Miscellaneous
      </h2>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          <strong>Entire agreement</strong> — these Terms (together with your service agreement, if
          any, and our Privacy Policy) form the complete agreement between you and Leadstaq.
        </li>
        <li>
          <strong>Severability</strong> — if any provision is found unenforceable, the rest remains
          in effect.
        </li>
        <li>
          <strong>Assignment</strong> — you may not assign these Terms without our written consent.
          We may assign them in connection with a merger, acquisition, or sale.
        </li>
        <li>
          <strong>No waiver</strong> — our failure to enforce any provision does not waive our
          right to enforce it later.
        </li>
        <li>
          <strong>Notices</strong> — we may send notices via email to your account address. Notices
          to us should go to{" "}
          <span className="rounded bg-surface-card-alt px-1.5 py-0.5 font-mono text-sm">
            legal@leadstaq.tech
          </span>
          .
        </li>
      </ul>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        18. Contact
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Questions about these Terms? Email{" "}
        <span className="rounded bg-surface-card-alt px-1.5 py-0.5 font-mono text-sm">
          legal@leadstaq.tech
        </span>{" "}
        or write to us at No 8 Roosevelt Road, Winston Park, Marondera, Zimbabwe.
      </p>
    </>
  );
}
