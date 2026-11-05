import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderMandatePdf } from "../../lib/real-estate/seller-intake/pdf";
import type { IntakeSnapshot } from "../../lib/real-estate/seller-intake/review-plan";

const out = join(process.cwd(), "docs", "verification", "samples");
mkdirSync(out, { recursive: true });

const submittedAt = "2026-11-05T08:00:00.000Z";
const longOwner = "Tatenda Moyo-Chikwanha Representative of the Very Long Registered Trading Name";
const longAddress = "Stand 4182, corner of Borrowdale Road and a private lane behind the old school, Harare, described again so the line has to wrap onto the next line of the page";

const samples: Array<{ file: string; snapshot: IntakeSnapshot }> = [
  {
    file: "synthetic-individual-open.pdf",
    snapshot: {
      templateId: "synthetic-open",
      templateVersion: 1,
      kind: "open",
      title: "Synthetic open mandate",
      organisationName: "Synthetic Agency (not a production template)",
      clauses: ["Synthetic clause only. No fee, VAT or agency identity is supplied by the platform."],
      exclusivityMinimumMonths: null,
      exclusivityContinuesUntilVaried: false,
      submittedAt,
      answers: {
        propertyAddress: "12 Cork Road, Avondale, Harare",
        registeredOwner: "Rudo Moyo",
        propertyCategory: "House",
        propertyRights: "Full Title",
        titleReference: "1234/2020",
        propertyDescription: "A house with a separate cottage.",
        occupation: "Owner occupied",
        occupantName: "Rudo Moyo",
        occupantPhone: "0770000000",
        mandateStartDate: "2026-11-01",
        mandateEndDate: "2027-04-30",
        mandatePrice: "80000",
        mandatePriceWords: "Eighty thousand",
        paymentMode: "Electronic",
        askingPrice: "90000",
        sellerTitle: "Ms",
        surname: "Moyo",
        givenName: "Rudo",
        nationality: "Zimbabwean",
        identityNumber: "SYNTHETIC-ID",
        maritalStatus: "Single",
        cell: "0770000000",
        email: "rudo@example.test",
        residentialAddress: "12 Cork Road, Avondale",
        sourceOfFunds: "Salary",
        pep: "No",
        ownerKind: "Individual",
      },
    },
  },
  {
    file: "synthetic-company-open.pdf",
    snapshot: {
      templateId: "synthetic-open",
      templateVersion: 1,
      kind: "open",
      title: "Synthetic open mandate",
      organisationName: "Synthetic Agency (not a production template)",
      clauses: ["Synthetic company clause. The representative is not the registered owner."],
      exclusivityMinimumMonths: null,
      exclusivityContinuesUntilVaried: false,
      submittedAt,
      answers: {
        propertyAddress: longAddress,
        registeredOwner: "Moyo Holdings (Private) Limited",
        propertyCategory: "Commercial",
        propertyRights: "Sectional Title",
        titleReference: "ST-998877",
        propertyDescription: longOwner,
        occupation: "Tenant occupied",
        occupantName: longOwner,
        occupantPhone: "0771111111",
        mandateStartDate: "2026-12-01",
        mandateEndDate: "2027-05-31",
        mandatePrice: "250000",
        mandatePriceWords: "Two hundred and fifty thousand",
        paymentMode: "Cash",
        askingPrice: "275000",
        ownerKind: "Company",
        companyName: "Moyo Holdings (Private) Limited",
        companyAddress: longAddress,
        representativeName: longOwner,
        representativePosition: "Director",
        representativePhone: "0772222222",
        representativeIdentity: "SYNTHETIC-REP-ID",
        shareholderLines: "A. Shareholder 40 percent; B. Shareholder 20 percent",
      },
    },
  },
  {
    file: "synthetic-sole-continuation.pdf",
    snapshot: {
      templateId: "synthetic-sole",
      templateVersion: 1,
      kind: "sole",
      title: "Synthetic sole mandate",
      organisationName: "Synthetic Agency (not a production template)",
      clauses: ["Synthetic continuation clause. The two-month period is template text, not a platform default."],
      exclusivityMinimumMonths: 2,
      exclusivityContinuesUntilVaried: true,
      submittedAt,
      answers: {
        propertyAddress: "Stand 4, Borrowdale, Harare",
        registeredOwner: "Rudo Moyo",
        residentialAddress: "8 Second Street, Harare",
        cell: "0773333333",
        askingPrice: "500000",
        ownerKind: "Individual",
      },
    },
  },
];

const pages: string[] = [];
for (const sample of samples) {
  const rendered = renderMandatePdf(sample.snapshot);
  writeFileSync(join(out, sample.file), rendered.bytes);
  pages.push(`<section><h2>${sample.file}</h2><p>Rendered from the PDF layout function. ${rendered.pageCount} pages. Synthetic. Not an organisation-approved template.</p>`);
  rendered.pages.forEach((page, index) => {
    pages.push(`<article class="page"><pre>${page.map((line) => line.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch] ?? ch)).join("\n")}</pre><p>Page ${index + 1}</p></article>`);
  });
  pages.push("</section>");
}

writeFileSync(join(out, "pdf-layout.html"), `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic mandate layout</title><style>
body{margin:0;background:#e7e5e4;font-family:Helvetica,Arial,sans-serif;color:#1c1917}
section{padding:24px}
h2{font-size:16px}
.page{width:210mm;min-height:297mm;margin:16px auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)}
pre{margin:0;padding:18mm 18mm 12mm;font-family:Helvetica,Arial,sans-serif;font-size:11pt;line-height:15pt;white-space:pre-wrap;word-break:break-word}
p{margin:0;padding:0 18mm 8mm;font-size:11px;color:#57534e}
</style></head><body>${pages.join("")}</body></html>`);

console.log(JSON.stringify(samples.map((sample) => sample.file)));
