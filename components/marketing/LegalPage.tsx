import { Info } from "lucide-react";
import type { LegalDoc } from "@/lib/legal";

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <section className="pt-14 pb-6">
        <div className="mx-auto max-w-[1100px] px-5 max-w-[840px]">
          <div className="text-xs tracking-widest font-semibold text-[#8a8a8a]">LEGAL</div>
          <h1 className="mt-3 text-[36px] sm:text-[44px] leading-[1.06] font-extrabold tracking-tight">{doc.title}</h1>
          <p className="mt-3 text-[14px] text-[#8a8a8a]">Last updated: {doc.lastUpdated}</p>
          <div className="mt-5 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 flex gap-3">
            <Info className="w-[18px] h-[18px] text-[#5b5b5b] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#5b5b5b]">This is a starting template, not legal advice. Have it reviewed by a qualified professional and tailored to your actual data practices and the laws of the markets you operate in (Zimbabwe, Zambia, South Africa, Kenya) before you publish it.</p>
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-[1000px] px-5 grid lg:grid-cols-[220px_1fr] gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="text-xs tracking-widest font-semibold text-[#8a8a8a] mb-2">ON THIS PAGE</div>
              <nav className="border-l border-black/[0.08] pl-3">
                {doc.sections.map((s, i) => (
                  <a key={s.id} href={`#${s.id}`} className="block py-[5px] text-[13px] text-[#5b5b5b] hover:text-black">{i + 1}. {s.h}</a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="max-w-[680px]">
            {doc.sections.map((s, i) => (
              <section key={s.id} id={s.id} className={i > 0 ? "mt-10 scroll-mt-24" : "scroll-mt-24"}>
                <h2 className="text-[20px] font-extrabold">{i + 1}. {s.h}</h2>
                <div
                  className="legal-prose [&_p]:text-[15px] [&_p]:leading-[1.7] [&_p]:text-[#5b5b5b] [&_p]:mt-2.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mt-2.5 [&_ul]:text-[15px] [&_ul]:leading-[1.7] [&_ul]:text-[#5b5b5b] [&_li]:mt-1 [&_a]:text-black [&_a]:underline [&_strong]:text-[#0C0C0C]"
                  dangerouslySetInnerHTML={{ __html: s.body }}
                />
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
