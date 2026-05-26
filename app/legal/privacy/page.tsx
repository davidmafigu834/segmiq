import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Segmiq",
  description: "How Segmiq collects, uses, and protects your data.",
};

const LAST_UPDATED = "29 April 2026";

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1 className="mb-3 font-serif text-4xl tracking-tight text-ink-primary md:text-5xl">
        Privacy Policy
      </h1>
      <p className="mb-12 font-mono text-sm uppercase tracking-[0.1em] text-ink-tertiary">
        Last updated · {LAST_UPDATED}
      </p>

      <p className="mb-8 text-base leading-relaxed text-ink-secondary">
        This Privacy Policy explains how Segmiq (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, shares, and
        protects information in connection with the Segmiq platform, websites, and services
        (collectively, the &quot;Service&quot;). By using the Service, you agree to the practices described
        here.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        1. Who we are
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Segmiq is a software-as-a-service platform operated by Adlense Network, a company
        registered in Zimbabwe (registration number No 11026/2023). Our principal place of
        business is No 8 Roosevelt Road, Winston Park, Marondera, Zimbabwe.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        For privacy questions, contact us at{" "}
        <span className="rounded bg-surface-card-alt px-1.5 py-0.5 font-mono text-sm">
          legal@leadstaq.tech
        </span>
        .
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        2. Who this policy applies to
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Segmiq serves three categories of people, and this policy explains how we treat data for
        each:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          <strong>Agency users</strong> — marketing agencies that use Segmiq to manage lead
          generation for their clients.
        </li>
        <li>
          <strong>Client users</strong> — businesses (and their staff) who are clients of an agency
          and use Segmiq to view leads and pipeline data.
        </li>
        <li>
          <strong>Leads</strong> — members of the public who submit forms on landing pages built
          with Segmiq, expressing interest in the products or services of a Client.
        </li>
      </ul>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        3. Information we collect
      </h2>

      <h3 className="mb-3 mt-8 font-serif text-xl text-ink-primary">
        3.1 From Agency and Client users
      </h3>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        When you create an account or use the Service, we collect:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          Account information: name, email address, phone number, password (hashed), profile photo
          (optional).
        </li>
        <li>
          Business information: company name, industry, address, billing details, branding assets.
        </li>
        <li>
          Authentication data: login times, session tokens, IP addresses for security purposes.
        </li>
        <li>Usage data: pages visited, features used, actions taken within the platform.</li>
        <li>
          Communication preferences: notification settings (WhatsApp, email, in-app).
        </li>
        <li>
          Integrations data: access tokens for connected services (Meta Business, Twilio, etc.) —
          stored encrypted.
        </li>
      </ul>

      <h3 className="mb-3 mt-8 font-serif text-xl text-ink-primary">
        3.2 From Leads (form submissions)
      </h3>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        When a member of the public submits a form on a Client&apos;s landing page, we collect the
        information they provide. This typically includes name, phone number, email address, project
        budget, project type, timeline, and any custom answers the Client has configured. Leads also
        generate metadata such as submission timestamp, source (Facebook ad campaign or direct
        landing page visit), and IP address.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        <strong>Important role distinction:</strong> For Lead data, the Client is the data
        controller — they decide what to ask, why they need it, and how it will be used. Segmiq is
        the data processor, handling the data on the Client&apos;s behalf according to their instructions
        and this policy.
      </p>

      <h3 className="mb-3 mt-8 font-serif text-xl text-ink-primary">3.3 Automatic collection</h3>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          Cookies and similar technologies used for authentication, session management, and
          preference storage.
        </li>
        <li>Browser type, operating system, device type.</li>
        <li>Referring URLs and pages viewed.</li>
        <li>
          Approximate location based on IP address (for security and fraud prevention).
        </li>
      </ul>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        4. How we use information
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We use the information we collect to:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>Provide, maintain, and improve the Service.</li>
        <li>Authenticate users and protect against fraud and abuse.</li>
        <li>
          Route Lead submissions from forms to the appropriate Client and salesperson.
        </li>
        <li>
          Send notifications via WhatsApp, email, and in-app messages (based on user preferences).
        </li>
        <li>Generate reporting and analytics for Agencies and Clients.</li>
        <li>Process payments for our paid plans.</li>
        <li>
          Communicate with users about service updates, billing, and support.
        </li>
        <li>Comply with legal obligations.</li>
      </ul>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We do not sell personal data. We do not use Lead data to train artificial intelligence models
        or for any purpose unrelated to delivering the Service to the Client who collected it.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        5. Legal basis for processing
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Where applicable law (such as the Zimbabwe Cyber and Data Protection Act, 2021, or the EU
        General Data Protection Regulation) requires a legal basis, we rely on:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          <strong>Contract performance</strong> — to provide the Service to Agencies and Clients.
        </li>
        <li>
          <strong>Legitimate interest</strong> — for security, fraud prevention, and platform
          improvement.
        </li>
        <li>
          <strong>Consent</strong> — for marketing communications and where required for Lead form
          submissions (consent collected by the Client at the point of submission).
        </li>
        <li>
          <strong>Legal obligation</strong> — for tax, accounting, and regulatory compliance.
        </li>
      </ul>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        6. Sharing and sub-processors
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We share data with the following categories of third parties to operate the Service:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          <strong>Supabase</strong> — database and authentication infrastructure.
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and content delivery.
        </li>
        <li>
          <strong>Meta (Facebook/WhatsApp)</strong> — for Lead Ads ingestion and WhatsApp message
          delivery.
        </li>
        <li>
          <strong>Twilio</strong> — for backup SMS and WhatsApp delivery (if applicable).
        </li>
        <li>
          <strong>SendGrid</strong> — for transactional email delivery.
        </li>
        <li>
          <strong>Payment processors</strong> — for handling subscription payments.
        </li>
        <li>
          <strong>Professional advisors</strong> — accountants, auditors, and lawyers as needed.
        </li>
        <li>
          <strong>Government authorities</strong> — when legally required.
        </li>
      </ul>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Our sub-processors are bound by contracts requiring them to handle data with appropriate
        safeguards. The current sub-processor list above is updated periodically — material changes
        will be communicated to Agencies and Clients.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        7. International data transfers
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Some of our sub-processors store data outside Zimbabwe (notably in the United States and
        Europe). We rely on contractual safeguards (such as Standard Contractual Clauses where
        applicable) to ensure data is protected during these transfers.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        8. Data retention
      </h2>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>
          <strong>Account data</strong> — retained while your account is active and for up to 12
          months after closure for legal and accounting purposes.
        </li>
        <li>
          <strong>Lead data</strong> — retained for as long as the Client&apos;s contract with their
          Agency is active. After contract termination, retained for 90 days, then permanently
          deleted unless the Client requests longer retention or earlier deletion.
        </li>
        <li>
          <strong>Logs and analytics</strong> — typically 12 months.
        </li>
        <li>
          <strong>Billing records</strong> — retained for the period required by Zimbabwean tax and
          corporate law (typically 6 years).
        </li>
      </ul>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        9. Your rights
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Depending on your jurisdiction, you may have the right to:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink-primary">
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate data.</li>
        <li>Request deletion of your data (&quot;right to be forgotten&quot;).</li>
        <li>Object to or restrict certain processing.</li>
        <li>Receive a copy of your data in a portable format.</li>
        <li>Withdraw consent where processing is based on consent.</li>
        <li>
          Lodge a complaint with the Postal and Telecommunications Regulatory Authority of Zimbabwe
          (POTRAZ) or your local data protection authority.
        </li>
      </ul>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        For Lead data, requests should be directed first to the Client (the agency&apos;s customer) who
        collected your information. If you submitted a form on a landing page built with Segmiq,
        the business operating that landing page is the data controller for your information.
      </p>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        To exercise any right, email us at{" "}
        <span className="rounded bg-surface-card-alt px-1.5 py-0.5 font-mono text-sm">
          legal@leadstaq.tech
        </span>
        . We respond within 30 days.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        10. Security
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We use industry-standard practices including HTTPS encryption, hashed passwords, encrypted
        token storage, role-based access controls, and audit logging. No system is perfectly secure
        — if you become aware of a security issue, please contact us immediately.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        11. Cookies
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We use cookies and similar technologies for authentication (keeping you logged in),
        preferences (remembering settings), and analytics (understanding how the Service is used).
        You can disable cookies in your browser, but parts of the Service may not function without
        them.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        12. Children&apos;s privacy
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        The Service is not directed at children under 18. We do not knowingly collect data from
        children. If you believe a child has submitted information through Segmiq, contact us and
        we will delete it.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        13. Changes to this policy
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        We may update this Privacy Policy from time to time. Material changes will be communicated
        via email to account holders or via a notice on this page. The &quot;Last updated&quot; date at the
        top of this page reflects when the most recent changes took effect.
      </p>

      <h2 className="mb-4 mt-12 font-serif text-2xl tracking-tight text-ink-primary md:text-3xl">
        14. Contact
      </h2>
      <p className="mb-4 text-base leading-relaxed text-ink-primary">
        Questions about this policy or our data practices? Email{" "}
        <span className="rounded bg-surface-card-alt px-1.5 py-0.5 font-mono text-sm">
          legal@leadstaq.tech
        </span>{" "}
        or write to us at No 8 Roosevelt Road, Winston Park, Marondera, Zimbabwe.
      </p>
    </>
  );
}
