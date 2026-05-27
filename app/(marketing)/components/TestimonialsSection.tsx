const TESTIMONIALS = [
  {
    stars: 5,
    quote: '"We were losing leads because nobody called fast enough. Now the team gets a WhatsApp the second a lead comes in and the system tells them who to call first. Our contact rate went from 30% to 71% in three weeks."',
    initials: 'TM',
    name: 'Tendai Moyo',
    role: 'Director · SunPower Solar, Harare',
    avatarBg: 'bg-[#D4FF4F]/[0.12]',
    avatarText: 'text-[#D4FF4F]',
  },
  {
    stars: 5,
    quote: '"My top salesperson left and I was terrified we would lose everything. Because it was all on Segmiq the new person was up to speed in two days. Every call logged, every note there. Nothing was lost."',
    initials: 'GN',
    name: 'Grace Ndlovu',
    role: 'Owner · BuildRight Construction, Lusaka',
    avatarBg: 'bg-[#60a5fa]/[0.12]',
    avatarText: 'text-[#60a5fa]',
  },
  {
    stars: 5,
    quote: '"The audience export feature alone is worth the price. We uploaded our 180 won customers as a lookalike on Facebook and our cost per qualified lead dropped by 40%. The data was sitting there the whole time."',
    initials: 'FK',
    name: 'Farai Khumalo',
    role: 'CEO · Apex Roofing, Johannesburg',
    avatarBg: 'bg-[#a78bfa]/[0.12]',
    avatarText: 'text-[#a78bfa]',
  },
];

const INDUSTRIES = [
  { emoji: '☀️', label: 'Solar installation' },
  { emoji: '🏗️', label: 'Construction' },
  { emoji: '🏠', label: 'Roofing' },
  { emoji: '⚡', label: 'Electrical' },
  { emoji: '🌿', label: 'Landscaping' },
  { emoji: '🔧', label: 'Plumbing' },
  { emoji: '🛠️', label: 'General trade' },
];

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="bg-[#0C0C0C] py-20 sm:py-24 lg:py-28 px-5 sm:px-8 lg:px-10"
    >
      <div className="max-w-[1100px] mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/30 mb-3">
          What clients say
        </p>
        <h2 className="text-[32px] sm:text-[38px] lg:text-[44px] font-extrabold text-white leading-[1.1] tracking-tight mb-12 sm:mb-16">
          Built for businesses{' '}
          <span className="text-[#D4FF4F]">like yours</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-14 sm:mb-16">
          {TESTIMONIALS.map(t => (
            <div
              key={t.name}
              className="bg-[#161616] border border-white/[0.07] rounded-[18px] p-6 sm:p-7 flex flex-col"
            >
              <div className="text-[#D4FF4F] text-[14px] tracking-[3px] mb-4">
                {'★'.repeat(t.stars)}
              </div>
              <p className="text-[14px] text-white/55 leading-[1.75] mb-6 flex-1 italic">
                {t.quote}
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div
                  className={`w-[38px] h-[38px] rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${t.avatarBg} ${t.avatarText}`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white/90">{t.name}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Industry pills */}
        <div className="pt-10 border-t border-white/[0.06]">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/20 mb-5 text-center">
            Built for these industries
          </p>
          <div className="flex flex-wrap gap-2.5 justify-center">
            {INDUSTRIES.map(ind => (
              <div
                key={ind.label}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border border-white/[0.07] rounded-full text-[13px] font-semibold text-white/40"
              >
                <span aria-hidden="true">{ind.emoji}</span>
                {ind.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
