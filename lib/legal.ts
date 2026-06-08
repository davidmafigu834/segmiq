/**
 * Legal page content. These are STARTING TEMPLATES, not legal advice — have them reviewed by
 * a qualified professional and tailored to your actual data practices and the laws of the
 * markets you operate in (Zimbabwe, Zambia, South Africa, Kenya) before publishing.
 *
 * `body` is trusted HTML authored here (rendered with dangerouslySetInnerHTML in LegalPage).
 */

export type LegalSection = { id: string; h: string; body: string };
export type LegalDoc = { title: string; lastUpdated: string; sections: LegalSection[] };

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  lastUpdated: "8 June 2026",
  sections: [
    { id: "intro", h: "Who we are", body: `<p>Segmiq (“Segmiq”, “we”, “us”) provides a revenue operating system for service businesses, made up of Segmiq CRM and Segmiq Cloud, available at segmiq.com and cloud.segmiq.com. This policy explains what personal information we handle and how. Questions can be sent to <a href="mailto:privacy@segmiq.com">privacy@segmiq.com</a>.</p>` },
    { id: "collect", h: "Information we collect", body: `<p>We collect information you give us and information generated as you use the service:</p><ul><li><strong>Account information</strong> — name, email, phone/WhatsApp number, company, and role, for the people who use our portals.</li><li><strong>Customer content</strong> — the lead and project data our business customers create or upload, including the details of their prospects (see section 4).</li><li><strong>Usage data</strong> — log data, device and browser information, and how the product is used.</li><li><strong>Communications</strong> — messages you exchange with us and messages sent through the platform, including via WhatsApp and email.</li><li><strong>Cookies</strong> — used to keep you signed in and to understand product usage.</li></ul>` },
    { id: "use", h: "How we use information", body: `<p>We use information to provide and operate the service, authenticate users, send transactional and product messages, provide support, improve and secure the platform, and meet legal obligations. We do not sell personal information.</p>` },
    { id: "leads", h: "Data we handle for our customers", body: `<p>For lead and prospect data that our business customers put into the platform, the customer is the controller of that data and Segmiq acts as a processor on their behalf. Customers are responsible for having a lawful basis to collect and contact those prospects, including any consent required for WhatsApp messaging. If you are a prospect and want your data handled or removed, please contact the business you dealt with; we will support them in responding.</p>` },
    { id: "share", h: "Sharing and sub-processors", body: `<p>We share information with service providers who help us run the platform, under appropriate agreements. These currently include:</p><ul><li>Supabase (database and authentication)</li><li>Cloudflare R2 (file and image storage)</li><li>Meta WhatsApp Cloud API and Twilio (messaging)</li><li>Resend (transactional email)</li><li>Vercel (application hosting)</li></ul><p>We may also disclose information where required by law. Keep this list current as your providers change.</p>` },
    { id: "retention", h: "Data retention", body: `<p>We keep personal information for as long as an account is active and as needed to provide the service, then for any period required for legal, accounting, or dispute-resolution purposes. Customers can delete records, and deletion flows through to our systems on a defined schedule.</p>` },
    { id: "ownership", h: "Data ownership and export", body: `<p>Your data belongs to you. Customers can export their leads, projects, and related records, and can request deletion of their account data. Specify your export formats and timelines here.</p>` },
    { id: "security", h: "Security", body: `<p>We use industry-standard measures including encryption in transit, scoped access by portal and role, and reputable infrastructure providers. No system is perfectly secure; we work continuously to protect your data. See our Security page for more.</p>` },
    { id: "transfers", h: "International transfers", body: `<p>Our providers may process data in locations outside your country. Where that happens, we rely on appropriate safeguards. Describe the specific transfer mechanisms relevant to your markets here.</p>` },
    { id: "rights", h: "Your rights", body: `<p>Depending on your jurisdiction, you may have rights to access, correct, delete, or restrict the use of your personal information, and to object to certain processing. To exercise these rights, contact <a href="mailto:privacy@segmiq.com">privacy@segmiq.com</a>. If you are a prospect of one of our customers, contact that business first.</p>` },
    { id: "children", h: "Children", body: `<p>The service is intended for businesses and is not directed to children. We do not knowingly collect personal information from children.</p>` },
    { id: "changes", h: "Changes to this policy", body: `<p>We may update this policy from time to time. We will change the “last updated” date above and, for material changes, provide a more prominent notice.</p>` },
    { id: "contact", h: "Contact us", body: `<p>For any privacy question or request, contact <a href="mailto:privacy@segmiq.com">privacy@segmiq.com</a>. Add your registered business name and address here.</p>` },
  ],
};

export const TERMS: LegalDoc = {
  title: "Terms of Service",
  lastUpdated: "8 June 2026",
  sections: [
    { id: "agreement", h: "Agreement to terms", body: `<p>These Terms govern your access to and use of Segmiq CRM and Segmiq Cloud and the segmiq.com and cloud.segmiq.com websites. By using the service you agree to these Terms. If you are using it on behalf of a business, you confirm you are authorised to bind that business.</p>` },
    { id: "service", h: "The service", body: `<p>Segmiq provides software to capture, manage, score, and convert leads (Segmiq CRM) and to document and showcase projects (Segmiq Cloud). Features may change as we improve the product. The two products share an account but may be offered on separate plans.</p>` },
    { id: "accounts", h: "Accounts and eligibility", body: `<p>You must provide accurate account information and keep your credentials secure. You are responsible for activity under your accounts and for your users. You must be able to form a binding contract to use the service.</p>` },
    { id: "billing", h: "Plans, billing, and payment", body: `<p>Paid plans are billed in advance on a recurring basis (monthly unless stated otherwise) per the pricing presented at sign-up. Fees are non-refundable except where required by law or expressly stated. We may change pricing with reasonable notice. Set out your currency, taxes, late-payment, and cancellation terms here.</p>` },
    { id: "acceptable", h: "Acceptable use", body: `<p>You agree not to misuse the service, including by breaking the law, infringing others’ rights, sending unlawful or unsolicited messages, attempting to breach security, or interfering with the platform. Messaging through WhatsApp and other channels must comply with those providers’ policies.</p>` },
    { id: "customerdata", h: "Customer data and responsibilities", body: `<p>You retain ownership of the data you put into the service. You grant us the rights needed to host and process it to provide the service. You are responsible for having a lawful basis to collect and contact the prospects whose data you upload, including any consent required for messaging, and for the content you publish on public profiles.</p>` },
    { id: "ip", h: "Intellectual property", body: `<p>Segmiq and its software, design, and brand are owned by us. We grant you a limited, non-exclusive, non-transferable right to use the service during your subscription. You may not copy, resell, or reverse-engineer the platform except as allowed by law.</p>` },
    { id: "thirdparty", h: "Third-party services", body: `<p>The service relies on third parties such as Meta WhatsApp, Twilio, and others. Their availability and terms are outside our control, and your use of those integrations is also subject to their terms.</p>` },
    { id: "confidentiality", h: "Confidentiality", body: `<p>Each party may receive non-public information from the other. The receiving party will protect it and use it only to perform under these Terms.</p>` },
    { id: "warranties", h: "Disclaimers", body: `<p>The service is provided “as is” to the extent permitted by law. We do not warrant that it will be uninterrupted or error-free, or that it will achieve any particular sales outcome. Any performance figures shown are illustrative.</p>` },
    { id: "liability", h: "Limitation of liability", body: `<p>To the maximum extent permitted by law, neither party is liable for indirect or consequential losses, and our total liability is limited as set out here (commonly capped at the fees paid in the preceding period). Set your specific cap and exclusions with your advisor.</p>` },
    { id: "termination", h: "Term and termination", body: `<p>These Terms apply while you use the service. You may stop using it at any time. We may suspend or terminate access for breach of these Terms or non-payment. On termination, you can export your data for a defined window, after which it may be deleted.</p>` },
    { id: "changes", h: "Changes to these terms", body: `<p>We may update these Terms. We will update the “last updated” date and, for material changes, give reasonable notice. Continued use after changes means you accept them.</p>` },
    { id: "law", h: "Governing law", body: `<p>State the governing law and the courts or dispute-resolution venue that apply (for example, the jurisdiction where Segmiq is registered). Confirm this with your legal advisor for the markets you operate in.</p>` },
    { id: "contact", h: "Contact us", body: `<p>Questions about these Terms can be sent to <a href="mailto:legal@segmiq.com">legal@segmiq.com</a>. Add your registered business name and address here.</p>` },
  ],
};
