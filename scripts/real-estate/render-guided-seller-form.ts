import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SellerMandateExperience, type SellerFormModel } from "@/components/real-estate/seller-intake/SellerMandateExperience";
import { exclusivityNote, fieldsForKind } from "@/lib/real-estate/seller-intake/fields";

const out = join(process.cwd(), "docs", "verification", "samples", "guided-form");
mkdirSync(out, { recursive: true });

function model(kind: "open" | "sole", answers: Record<string, string>): SellerFormModel {
  return {
    title: kind === "sole" ? "Sole selling mandate" : "Open selling mandate",
    kind,
    clauses: ["The owner appoints the agency to market the property on the terms recorded in this form."],
    exclusivityNote: exclusivityNote({ kind, minimumMonths: kind === "sole" ? 3 : null, continuesUntilVaried: kind === "sole" }),
    agencyName: "Harbour & Stone Properties",
    logoUrl: null,
    websiteUrl: "https://harbour.example",
    phone: "+263 77 000 0000",
    draftExists: false,
    fields: fieldsForKind(kind).map((field) => ({
      key: field.key,
      input: field.input,
      options: field.options,
      requiredToSubmit: field.requiredToSubmit,
      value: answers[field.key] ?? "",
      locked: false,
      instruction: null,
    })),
  };
}

function page(name: string, form: SellerFormModel, answers: Record<string, string>, step: number) {
  const body = renderToStaticMarkup(createElement(SellerMandateExperience, {
    form,
    answers,
    step,
    saveState: "idle" as const,
    error: null,
    fieldErrors: {},
    onAnswer: () => undefined,
    onStep: () => undefined,
    onBack: () => undefined,
    onSave: () => undefined,
    onContinue: () => undefined,
    onSubmit: () => undefined,
  }));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Instrument+Serif&display=swap"><style>:root{--font-dm-sans:"DM Sans",sans-serif;--font-instrument-serif:"Instrument Serif",Georgia,serif}body{margin:0}</style></head><body>${body}</body></html>`;
  writeFileSync(join(out, name), html);
}

const individual = { ownerKind: "Individual", propertyCategory: "House" };
page("open-individual.html", model("open", individual), individual, 0);

const company = {
  ownerKind: "Company",
  registeredOwner: "Moyo Holdings (Private) Limited",
  companyName: "Moyo Holdings (Private) Limited",
  representativeName: "Tariro Ncube",
};
page("open-company.html", model("open", company), company, 2);

const review = {
  ownerKind: "Individual",
  registeredOwner: "Rudo Moyo",
  propertyAddress: "12 Baker Avenue, Avondale, Harare",
  propertyCategory: "House",
  occupation: "Owner occupied",
  occupantName: "Rudo Moyo",
  givenName: "Rudo",
  surname: "Moyo",
  cell: "+263 77 123 4567",
  mandateStartDate: "2026-11-05",
  mandateEndDate: "2027-05-05",
  mandatePrice: "80000",
  askingPrice: "90000",
  paymentMode: "Electronic",
};
page("open-review.html", model("open", review), review, 5);
page("sole-individual.html", model("sole", { ownerKind: "Individual" }), { ownerKind: "Individual" }, 0);
console.log(out);
