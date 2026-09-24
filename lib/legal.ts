/**
 * Published legal copy for /terms and /privacy.
 * `body` is trusted HTML authored here (rendered with dangerouslySetInnerHTML in LegalPage).
 *
 * This is product-aligned drafting, not a substitute for independent legal review
 * under the laws of Zimbabwe, Zambia, South Africa, Kenya, or other markets we serve.
 */

export type LegalSection = { id: string; h: string; body: string };
export type LegalDoc = {
  title: string;
  lastUpdated: string;
  summary: string;
  sections: LegalSection[];
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  lastUpdated: "21 September 2026",
  summary:
    "This policy explains how Segmiq handles personal information for account holders, their teams, website visitors, and the prospects they capture through CRM, Cloud, WhatsApp, and related apps.",
  sections: [
    {
      id: "who",
      h: "Who we are",
      body: `<p>Segmiq (“Segmiq”, “we”, “us”) is a software platform operated by Adlense Network, a company registered in Zimbabwe (registration number 11026/2023). Our principal place of business is No 8 Roosevelt Road, Winston Park, Marondera, Zimbabwe.</p>
<p>The Service includes Segmiq CRM, Segmiq Cloud, company and solo workspaces, the WhatsApp Sales Hub, Agentic AI and Company Brain features, public profiles and forms, the blog, mobile apps, and the websites at segmiq.com, cloud.segmiq.com, and blog.segmiq.com.</p>
<p>Privacy questions: <a href="mailto:privacy@segmiq.com">privacy@segmiq.com</a>. Security issues: <a href="mailto:security@segmiq.com">security@segmiq.com</a>.</p>`,
    },
    {
      id: "scope",
      h: "Who this policy applies to",
      body: `<p>We handle information for several groups of people:</p>
<ul>
<li><strong>Account users</strong> — agency administrators, company owners and managers, salespeople, field workers, solo operators, and Cloud users who sign in.</li>
<li><strong>Customer content subjects</strong> — prospects, customers, and WhatsApp contacts whose details our business customers put into the Service (leads, form answers, conversations, project photos, quotations, and related records).</li>
<li><strong>Website visitors</strong> — people who browse our marketing sites, help centre, or blog, or who submit a demo or contact form.</li>
</ul>
<p>If you are a prospect of one of our customers, that business is the controller of your information. Contact them first. We will support them in responding.</p>`,
    },
    {
      id: "collect",
      h: "Information we collect",
      body: `<p>We collect information you give us, information generated as you use the Service, and information our customers store in their workspace.</p>
<p><strong>Account and business information.</strong> Name, email, phone or WhatsApp number, password (stored hashed), role, company name, industry, address, branding assets, billing details, and optional profile photo.</p>
<p><strong>Authentication and security.</strong> Login times, session tokens, IP address, device and browser information, multi-factor authentication setup, organisation security settings (such as MFA requirements and session timeouts), and audit logs of access and important actions.</p>
<p><strong>Usage data.</strong> Pages and features used, timestamps, and similar product-analytics needed to operate, debug, and improve the Service.</p>
<p><strong>Communications.</strong> Messages you send to us (email, WhatsApp, in-app, demo forms) and message logs for notifications we send (delivery and read status).</p>
<p><strong>Integration credentials.</strong> Tokens and connection details for services you connect — for example Meta (Facebook Lead Ads and WhatsApp Cloud API) or a paired WhatsApp inbox. Credentials are stored encrypted.</p>
<p><strong>Customer content</strong> (processed for the customer): lead and pipeline records; form answers; Facebook Lead Ads submissions; WhatsApp and in-app conversation content; call notes and timelines; quotations and commercial documents; project photos, videos, and files; public profile copy; contacts imported by the customer; team performance and weekly reports; and similar records the customer creates.</p>
<p><strong>Payment records.</strong> Invoices, payment proofs, bank or mobile-money references, and related billing history. We do not store card numbers. Subscriptions are billed by invoice (bank transfer, mobile money, or other published pay-in methods).</p>
<p><strong>Cookies and similar technologies.</strong> Used to keep you signed in, remember theme and similar preferences, and understand how the product and sites are used. See the Cookies section below.</p>`,
    },
    {
      id: "roles",
      h: "Our role versus your role",
      body: `<p>For account, billing, website, and support data, Segmiq is the controller: we decide how that information is used to run the platform.</p>
<p>For customer content — including leads, prospect contact details, WhatsApp conversations, project media, quotations, and imported contacts — the customer (the agency or the company workspace) is the controller. Segmiq acts as a processor: we host and process that data only to provide the Service, on the customer’s instructions, and as described in this policy and the Terms of Service.</p>
<p>Customers are responsible for having a lawful basis to collect and contact people whose data they put into Segmiq, including any consent required for WhatsApp, SMS, email, or other messaging, and for their own privacy notices to those people.</p>`,
    },
    {
      id: "use",
      h: "How we use information",
      body: `<p>We use information to:</p>
<ul>
<li>Provide, maintain, host, and improve the Service, including CRM, Cloud, inboxes, dashboards, reports, and mobile apps.</li>
<li>Authenticate users, protect accounts, detect fraud and abuse, and enforce role-based access.</li>
<li>Route enquiries to the right company and teammate, send transactional notifications, and operate follow-up reminders.</li>
<li>Run AI features the customer enables (see AI features below).</li>
<li>Issue invoices, confirm payments, and send billing notices.</li>
<li>Provide support, including time-limited Support Access when authorised (see Support Access below).</li>
<li>Communicate about the Service, security, and material changes to these documents.</li>
<li>Comply with law and enforce our Terms.</li>
</ul>
<p>We do not sell personal information. We do not use customer content to train our own foundation models, and we do not use lead or conversation data for advertising to those prospects on our own behalf.</p>`,
    },
    {
      id: "ai",
      h: "AI features",
      body: `<p>Depending on the plan and settings, the Service may use machine learning and large language models to score and brief leads, suggest replies, generate form questions, produce coaching and weekly insights, analyse wins, and — where enabled — run an agent that can qualify enquiries, draft or send messages, prepare quotations, create tasks, and escalate to a person.</p>
<p>To operate those features we send relevant workspace context (for example lead details, conversation excerpts, playbooks, catalogue facts, and Company Brain materials the customer has approved) to infrastructure and model providers listed in Sharing and sub-processors. That processing is to deliver the feature to that customer, not to build a public model from their pipeline.</p>
<p>AI output can be incomplete or wrong. Customers remain responsible for what is sent to prospects, especially where agent autonomy is set to send customer-visible messages. Company Brain is designed to retrieve the customer’s approved facts rather than invent coverage or prices; missing facts stay missing.</p>
<p>Customers can limit or disable capabilities in company settings (for example autonomy mode and which actions the agent may take). We retain related logs as needed to provide the Service, debug, and meet safety and audit requirements.</p>`,
    },
    {
      id: "messaging",
      h: "WhatsApp, email, and other channels",
      body: `<p>The Service can send and receive messages through Meta WhatsApp Cloud API, email (Resend), and, where still configured as a fallback, other messaging providers. Optional inbox pairing lets a customer connect a business WhatsApp number so conversations can be handled inside Segmiq.</p>
<p>Message content, media, delivery status, and related metadata are stored so the customer can run sales and support from one place. Session material for a paired number is encrypted. Official templates used under the Segmiq brand are Meta-approved; customers must also follow Meta, WhatsApp, and applicable anti-spam rules for any messages they initiate.</p>
<p>The customer is responsible for obtaining any required consent before messaging a person, honouring opt-outs, and using official channels rather than unofficial gateways.</p>`,
    },
    {
      id: "basis",
      h: "Legal bases",
      body: `<p>Where a law such as the Zimbabwe Cyber and Data Protection Act, 2021, South Africa’s Protection of Personal Information Act, Kenya’s Data Protection Act, 2019, Zambia’s Data Protection Act, 2021, or the EU/UK GDPR requires a legal basis, we rely on:</p>
<ul>
<li><strong>Contract</strong> — to create accounts, provide the Service, and bill for it.</li>
<li><strong>Legitimate interests</strong> — security, fraud prevention, product improvement, and limited operational analytics, balanced against people’s rights.</li>
<li><strong>Consent</strong> — where we ask for it (for example certain marketing messages) or where the customer collects it on a form for their own outreach.</li>
<li><strong>Legal obligation</strong> — tax, accounting, and regulatory requirements.</li>
</ul>
<p>Customers must establish their own lawful basis for lead and messaging data they control.</p>`,
    },
    {
      id: "share",
      h: "Sharing and sub-processors",
      body: `<p>We share information with service providers who help us run the platform, under contracts that require appropriate safeguards. Current categories include:</p>
<ul>
<li><strong>Supabase</strong> — database, authentication-related infrastructure, and some file storage.</li>
<li><strong>Vercel</strong> — application hosting, content delivery, and (where configured) AI Gateway access to models.</li>
<li><strong>Cloudflare R2</strong> — object storage for project photos, documents, and similar media.</li>
<li><strong>Meta</strong> — WhatsApp Cloud API, Facebook Login, Lead Ads ingestion, and related Graph API features you connect.</li>
<li><strong>Resend</strong> — transactional and notification email.</li>
<li><strong>Twilio</strong> — retained only as a messaging fallback where still configured.</li>
<li><strong>Anthropic, Google (Gemini), Groq, and similar model providers</strong> — inference for AI features the customer uses.</li>
<li><strong>Professional advisors</strong> — accountants, auditors, and lawyers as needed.</li>
<li><strong>Authorities</strong> — when required by law.</li>
</ul>
<p>We may also share information with a customer’s authorised users, with an agency that manages that customer’s workspace, and with a person the customer messages through the Service. If we sell or reorganise the business, information may transfer to a successor under this policy.</p>`,
    },
    {
      id: "support",
      h: "Support Access",
      body: `<p>To diagnose a problem, Segmiq staff may request time-limited, scoped access to a customer workspace (“Support Access”). Access is never permanent. Ordinary support sessions are capped (currently up to two hours); emergency “break-glass” access is shorter. The request records a reason, is approved according to the organisation’s rules, is logged, and can be revoked.</p>
<p>Staff see only what the approved scopes allow. We use this access to provide support, not to market to the customer’s prospects.</p>`,
    },
    {
      id: "transfers",
      h: "International transfers",
      body: `<p>We are based in Zimbabwe. Sub-processors may store or process information in other countries, including the United States and Europe. Where a transfer is restricted by law, we rely on appropriate safeguards such as contracts (including Standard Contractual Clauses where they apply) and the security measures described in this policy.</p>`,
    },
    {
      id: "retention",
      h: "How long we keep information",
      body: `<ul>
<li><strong>Account data</strong> — while the account is active, then up to 12 months after closure unless a longer period is required for security, disputes, or law.</li>
<li><strong>Customer content</strong> (leads, conversations, Cloud projects, and similar) — for as long as the workspace is active. After termination or a deletion request we aim to delete or de-identify it within 90 days, except where we must keep a copy (for example billing disputes, legal holds, or backups that rotate on a longer cycle).</li>
<li><strong>Logs and operational analytics</strong> — typically up to 12 months.</li>
<li><strong>Billing and tax records</strong> — for the period required by Zimbabwean tax and company law (typically six years).</li>
</ul>
<p>Customers can delete individual records in the product where that feature exists. Deletion then flows through to our systems on a defined schedule, including backups.</p>`,
    },
    {
      id: "ownership",
      h: "Ownership, export, and deletion",
      body: `<p>Customer content belongs to the customer. Segmiq does not claim ownership of leads, project media, or similar workspace data.</p>
<p>Customers can export audience segments and related records from the product (for example Meta-compatible CSV). Account holders can also request an export or deletion of their account data at <a href="mailto:privacy@segmiq.com">privacy@segmiq.com</a>. We will respond within 30 days.</p>
<p>Prospects who want their information corrected or removed should contact the business they dealt with. We will help that customer action a valid request.</p>`,
    },
    {
      id: "security",
      h: "Security",
      body: `<p>We use measures appropriate to a hosted business platform, including TLS in transit, hashed passwords, encrypted storage of integration tokens and paired WhatsApp session material, role-scoped portals (agency, company, salesperson, Cloud, solo), optional multi-factor authentication, organisation session policies, and audit trails on leads and Support Access.</p>
<p>No system is perfectly secure. If you believe there is a vulnerability, email <a href="mailto:security@segmiq.com">security@segmiq.com</a>. More detail on practices we actually implement is on our <a href="/security">Security</a> page.</p>`,
    },
    {
      id: "cookies",
      h: "Cookies",
      body: `<p>We use cookies and similar technologies to:</p>
<ul>
<li>Keep you signed in and protect sessions (necessary).</li>
<li>Remember preferences such as theme (functional).</li>
<li>Understand how the Service and marketing sites are used so we can fix issues and improve them (analytics, where used).</li>
</ul>
<p>You can block cookies in your browser. Sign-in and some features will not work without necessary cookies. We do not use cookies to sell a browsing profile to third-party advertisers.</p>`,
    },
    {
      id: "rights",
      h: "Your rights",
      body: `<p>Depending on where you live, you may have the right to access, correct, delete, or restrict use of personal information we hold; to object to certain processing; to receive a portable copy; and to withdraw consent where processing is based on consent.</p>
<p>You may also lodge a complaint with the Postal and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ), the Information Regulator (South Africa), the Office of the Data Protection Commissioner (Kenya), the Zambia Data Protection Commission, or another competent authority.</p>
<p>To exercise a right that we control, email <a href="mailto:privacy@segmiq.com">privacy@segmiq.com</a>. We respond within 30 days. We may need to verify your identity. If the request concerns data a customer controls, we will direct you to that customer or handle it with them.</p>`,
    },
    {
      id: "children",
      h: "Children",
      body: `<p>The Service is for businesses and is not directed at children under 18. We do not knowingly collect personal information from children. If you believe a child has submitted information through Segmiq, contact us and we will delete it.</p>`,
    },
    {
      id: "changes",
      h: "Changes to this policy",
      body: `<p>We may update this policy as the product or the law changes. We will change the “last updated” date above. For material changes we will give a more prominent notice — typically by email to account holders or a notice in the Service. Continued use after the effective date means the updated policy applies.</p>`,
    },
    {
      id: "contact",
      h: "Contact us",
      body: `<p>Adlense Network trading as Segmiq<br>No 8 Roosevelt Road, Winston Park, Marondera, Zimbabwe<br>Phone: <a href="tel:+263718558160">+263 71 855 8160</a></p>
<p>Privacy: <a href="mailto:privacy@segmiq.com">privacy@segmiq.com</a><br>Legal: <a href="mailto:legal@segmiq.com">legal@segmiq.com</a><br>Security: <a href="mailto:security@segmiq.com">security@segmiq.com</a></p>`,
    },
  ],
};

export const TERMS: LegalDoc = {
  title: "Terms of Service",
  lastUpdated: "21 September 2026",
  summary:
    "These terms govern your use of Segmiq CRM, Segmiq Cloud, company workspaces, WhatsApp inbox, AI features, mobile apps, and related websites.",
  sections: [
    {
      id: "agreement",
      h: "Agreement to terms",
      body: `<p>These Terms of Service (“Terms”) govern access to and use of Segmiq, operated by Adlense Network (“Segmiq”, “we”, “us”). By creating an account, inviting users, or using the Service, you agree to these Terms and to our Privacy Policy. If you use the Service on behalf of a business, you confirm you are authorised to bind that business.</p>
<p>If you do not agree, do not use the Service.</p>`,
    },
    {
      id: "service",
      h: "The service",
      body: `<p>Segmiq is a revenue operating system for service businesses. It currently includes:</p>
<ul>
<li><strong>Segmiq CRM</strong> — lead capture, scoring, routing, pipeline, quotations, documents, customer hub, team performance, and related dashboards. Workspaces may be agency-managed, company-owned, or solo.</li>
<li><strong>Segmiq Cloud</strong> — project documentation, media storage, public portfolios, and lead capture from those profiles.</li>
<li><strong>WhatsApp Sales Hub</strong> — notifications, templates, and optional inbox pairing so conversations can be handled inside Segmiq.</li>
<li><strong>Agentic AI and Company Brain</strong> — optional intelligence and agent features that score, brief, coach, retrieve approved company knowledge, and (where enabled) act under the customer’s autonomy settings.</li>
<li><strong>Related surfaces</strong> — public landing pages and instant forms, Facebook Lead Ads ingestion, billing, help centre, blog, and mobile apps for sales and field documentation.</li>
</ul>
<p>Features depend on the plan, industry modules, and settings you enable. We may add, change, or withdraw features as we improve the product. Segmiq CRM and Segmiq Cloud share an account system but may be billed as separate products.</p>
<p>We do not guarantee any particular volume of leads, conversion rate, or revenue. Results depend on your market, ads, team, and how you use the tools.</p>`,
    },
    {
      id: "accounts",
      h: "Accounts and eligibility",
      body: `<p>You must be at least 18 and able to form a binding contract. Provide accurate information and keep it current. You are responsible for credentials, for activity under your accounts, and for the users you invite.</p>
<p>Accounts may be created by invitation, by an agency for a client, or by self-signup (for example Segmiq Cloud). Notify us at <a href="mailto:legal@segmiq.com">legal@segmiq.com</a> if you suspect unauthorised access.</p>
<p>We may require or recommend multi-factor authentication for some roles. Organisation administrators may set MFA and session policies for their workspace.</p>`,
    },
    {
      id: "billing",
      h: "Plans, billing, and payment",
      body: `<p>Fees are as shown at signup, on the pricing page, or on the invoice or subscription we issue. Unless we agree otherwise in writing:</p>
<ul>
<li>Amounts are quoted in United States Dollars (USD).</li>
<li>CRM plans are billed per client company, monthly or annually (annual catalogue pricing charges ten months up front).</li>
<li>Cloud may be offered on its own plan. CRM and Cloud are not interchangeable credits.</li>
<li>Paid subscriptions are billed in advance. Fees are non-refundable except where required by law or we expressly agree.</li>
<li>We invoice rather than charging cards on file. You pay by the methods we publish (typically bank transfer or mobile money) and may need to submit proof of payment.</li>
<li>Late or missing payment may lead to reminders, past-due status, and suspension after any grace period on the subscription.</li>
</ul>
<p>Where an agency manages your workspace, the commercial terms in that service agreement apply alongside these Terms. Advertising spend on Meta or other networks is paid by you to that network and is not part of Segmiq’s fees.</p>
<p>We may change list prices with reasonable notice. Changes do not rewrite an amount already snapshotted on an active invoice or subscription unless we say so.</p>`,
    },
    {
      id: "acceptable",
      h: "Acceptable use",
      body: `<p>You agree not to:</p>
<ul>
<li>Use the Service for illegal, fraudulent, deceptive, or harmful purposes.</li>
<li>Send unsolicited or unlawful messages (spam) via WhatsApp, email, or any other channel.</li>
<li>Collect or contact people without a lawful basis, including required consent for messaging.</li>
<li>Violate Meta, WhatsApp, or any other integrated platform’s terms.</li>
<li>Upload malware, or attempt to probe, bypass, or disrupt security, rate limits, or access controls.</li>
<li>Copy, resell, sublicense, or reverse-engineer the platform except as allowed by law.</li>
<li>Impersonate another person or business, or publish false public-profile information.</li>
<li>Use AI features to generate unlawful, misleading, or infringing content, or to make promises the business cannot keep.</li>
<li>Interfere with another customer’s workspace or scrape the Service.</li>
</ul>
<p>We may suspend or terminate accounts that violate these rules, with or without prior notice depending on severity.</p>`,
    },
    {
      id: "customerdata",
      h: "Customer data and responsibilities",
      body: `<p>You retain ownership of content you put into the Service (leads, files, branding, conversation content, Cloud media, playbooks, and similar). You grant Segmiq a non-exclusive licence to host, process, transmit, and display that content solely to provide and secure the Service, including through sub-processors and AI providers described in the Privacy Policy.</p>
<p>You are responsible for:</p>
<ul>
<li>The accuracy and lawfulness of content you upload or publish, including public Cloud profiles and landing pages.</li>
<li>Having a lawful basis to store and contact prospects, and for your own privacy notices to them.</li>
<li>Reviewing customer-facing messages, quotations, and agent output before they go out — especially in higher-autonomy modes.</li>
<li>Configuring Company Brain with facts you stand behind (service areas, prices, FAQs, voice). The agent must not be used to invent coverage, discounts, or legal commitments.</li>
<li>Users you invite and the permissions you grant them.</li>
</ul>
<p>We may remove content that we reasonably believe violates these Terms, others’ rights, or the law.</p>`,
    },
    {
      id: "ai-terms",
      h: "AI and automation",
      body: `<p>AI features are optional tools. They may send workspace context to third-party model providers to generate scores, briefs, suggested messages, insights, or agent actions. Output is probabilistic: it can be wrong, incomplete, or outdated.</p>
<p>You choose autonomy settings (for example assist, copilot, or autopilot) and which capabilities are on. Restricted actions stay with a human. You remain responsible for compliance, for what prospects receive, and for decisions you make using AI output. Segmiq does not warrant that AI will achieve any sales result or that it will always escalate when a person would have.</p>
<p>We do not use your customer content to train our own foundation models. We do not sell it.</p>`,
    },
    {
      id: "messaging-terms",
      h: "Messaging and public pages",
      body: `<p>WhatsApp and similar integrations depend on Meta and other providers. Their availability, template approval, and account status are outside our control. If a provider suspends or changes its service, we will work to restore functionality but cannot guarantee uninterrupted messaging.</p>
<p>Public profiles, share links, landing pages, and instant forms are visible to anyone with the link (and may be indexed if you publish them that way). Do not put secrets there. You are responsible for the impression those pages create.</p>`,
    },
    {
      id: "ip",
      h: "Intellectual property",
      body: `<p>Segmiq and its software, design, templates, documentation, and brand are owned by us or our licensors. We grant you a limited, non-exclusive, non-transferable right to use the Service during your paid or permitted subscription, solely for your internal business purposes.</p>
<p>Landing-page, quote, and similar templates may be used inside the Service. They may not be extracted and reused as a competing product. Feedback you send us may be used to improve the platform without obligation to you.</p>`,
    },
    {
      id: "thirdparty",
      h: "Third-party services",
      body: `<p>The Service relies on third parties including Meta, Supabase, Vercel, Cloudflare, Resend, and AI model providers. Your use of a connected integration is also subject to that provider’s terms. We are not responsible for their outages, policy changes, or how they handle data once it is in their systems, beyond the contracts we have with them.</p>`,
    },
    {
      id: "support-terms",
      h: "Support Access and confidentiality",
      body: `<p>Each party may receive non-public information from the other. The receiving party will protect it and use it only to perform under these Terms.</p>
<p>If you ask for hands-on help, we may use Support Access: time-limited, scoped, logged access to your workspace, which you (or a second admin, depending on settings) approve and can revoke. We treat that access as confidential customer data.</p>`,
    },
    {
      id: "availability",
      h: "Availability and disclaimers",
      body: `<p>We aim for high availability but do not guarantee uninterrupted or error-free service. Maintenance, third-party outages, and events outside our reasonable control may affect access.</p>
<p>To the extent permitted by law, the Service is provided “as is” and “as available”, without warranties of merchantability, fitness for a particular purpose, or non-infringement. Any figures shown in marketing or dashboards are illustrative of the product, not a promise of your results.</p>`,
    },
    {
      id: "liability",
      h: "Limitation of liability",
      body: `<p>To the maximum extent permitted by law:</p>
<ul>
<li>Neither party is liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost revenue, lost data, or business interruption.</li>
<li>Segmiq’s total aggregate liability arising from these Terms or the Service is limited to the fees you paid us for the Service in the three (3) months before the event giving rise to the claim, or USD 100, whichever is greater.</li>
<li>We are not liable for acts or omissions of Meta, WhatsApp, model providers, or other third-party platforms.</li>
</ul>
<p>Nothing in these Terms excludes liability that cannot be excluded under Zimbabwean law, including for fraud or death or personal injury caused by negligence where that cannot be limited.</p>`,
    },
    {
      id: "indemnity",
      h: "Indemnification",
      body: `<p>You agree to indemnify and hold harmless Segmiq, Adlense Network, and our directors, employees, and agents from claims, damages, and reasonable legal fees arising from your content, your messaging, your use of AI features, your violation of these Terms, or your violation of third-party rights (including Meta policies and data-protection duties you owe to prospects).</p>`,
    },
    {
      id: "termination",
      h: "Term and termination",
      body: `<p>These Terms apply while you use the Service. You may stop using it at any time. Cancellation, notice periods, and final invoices follow your subscription or service agreement. Where a company workspace is billed by an agency, that agency’s process may apply.</p>
<p>We may suspend or terminate access for breach, non-payment, legal risk, or prolonged inactivity. On termination, access ends. You should export data you need beforehand. We will handle remaining data as described in the Privacy Policy (typically a 90-day window for customer content, then deletion, subject to legal holds and backups).</p>`,
    },
    {
      id: "changes",
      h: "Changes to these terms",
      body: `<p>We may update these Terms. We will change the “last updated” date and, for material changes, give reasonable notice by email or in the Service. Continued use after the effective date constitutes acceptance. If you do not agree, you must stop using the Service.</p>`,
    },
    {
      id: "law",
      h: "Governing law and disputes",
      body: `<p>These Terms are governed by the laws of Zimbabwe. Disputes will first be addressed through good-faith negotiation for at least 30 days. If unresolved, disputes will be referred to arbitration in Harare, Zimbabwe, or to the courts of Zimbabwe.</p>`,
    },
    {
      id: "misc",
      h: "Miscellaneous",
      body: `<ul>
<li><strong>Entire agreement</strong> — these Terms, the Privacy Policy, and any written service or subscription agreement between you and Segmiq (or, where applicable, your agency) form the complete agreement. If a signed service agreement conflicts with these Terms on fees or service levels, that agreement controls for those points.</li>
<li><strong>Severability</strong> — if a provision is unenforceable, the rest remains in effect.</li>
<li><strong>Assignment</strong> — you may not assign these Terms without our written consent. We may assign them in a merger, acquisition, or sale of the business.</li>
<li><strong>No waiver</strong> — failure to enforce a provision is not a waiver of the right to enforce it later.</li>
<li><strong>Notices</strong> — we may notify you via the email on your account. Notices to us: <a href="mailto:legal@segmiq.com">legal@segmiq.com</a>.</li>
</ul>`,
    },
    {
      id: "contact",
      h: "Contact us",
      body: `<p>Adlense Network trading as Segmiq<br>No 8 Roosevelt Road, Winston Park, Marondera, Zimbabwe<br>Phone: <a href="tel:+263718558160">+263 71 855 8160</a><br>Legal: <a href="mailto:legal@segmiq.com">legal@segmiq.com</a></p>`,
    },
  ],
};
