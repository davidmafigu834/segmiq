const FOOTER_LINKS: Record<string, string[]> = {
  Platform: ['Lead management', 'AI intelligence', 'Audience exports', 'Segmiq Cloud', 'Pricing'],
  Industries: ['Solar installation', 'Construction', 'Roofing', 'Electrical', 'Landscaping'],
  Company: ['About', 'Contact', 'Privacy policy', 'Terms of service'],
};

export function MarketingFooter() {
  return (
    <footer className="bg-[#080808] px-5 sm:px-8 lg:px-10 pt-14 sm:pt-16 pb-8">
      <div className="max-w-[1100px] mx-auto">

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 mb-12 sm:mb-14">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <p className="text-[22px] font-extrabold text-[#D4FF4F] mb-3 tracking-tight">
              Segmiq
            </p>
            <p className="text-[13px] text-white/30 leading-[1.65] max-w-[220px]">
              Revenue operating system for service businesses across
              Africa. Built for construction, solar, and trade companies.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/25 mb-4">
                {title}
              </h4>
              <div className="flex flex-col gap-2.5">
                {links.map(link => (
                  <a
                    key={link}
                    href="#"
                    className="text-[13px] text-white/40 hover:text-white/80 transition-colors duration-150"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-white/20">
            © 2026 Segmiq. All rights reserved.
          </p>
          <p className="text-[12px] text-white/20">segmiq.com</p>
        </div>
      </div>
    </footer>
  );
}
