import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="bg-[#0C0C0C] pt-16 pb-20 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32 px-5 sm:px-8 lg:px-10 overflow-hidden">
      <div className="max-w-[1100px] mx-auto">

        {/* Two-column on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* Left — copy */}
          <div>

            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#D4FF4F]/10 border border-[#D4FF4F]/20 rounded-full text-[11px] font-bold text-[#D4FF4F] uppercase tracking-[0.08em] mb-6 sm:mb-7">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M6 1L7.2 4.8H11L7.9 7.1L9.1 11L6 8.7L2.9 11L4.1 7.1L1 4.8H4.8L6 1Z" fill="#D4FF4F"/>
              </svg>
              AI-powered revenue platform
            </div>

            {/* Headline */}
            <h1 className="text-[38px] sm:text-[48px] lg:text-[56px] xl:text-[62px] font-extrabold leading-[1.06] tracking-[-1.5px] text-white mb-5 sm:mb-6">
              Stop losing leads.{' '}
              <span className="text-[#D4FF4F]">Start closing</span>{' '}
              more deals.
            </h1>

            {/* Sub */}
            <p className="text-[16px] sm:text-[17px] text-white/45 leading-[1.75] mb-8 sm:mb-10 max-w-[480px]">
              Segmiq gives construction, solar, and trade businesses
              instant WhatsApp follow-ups, AI lead intelligence, and
              Facebook audience exports — all in one platform.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10 sm:mb-12">
              <Link
                href="/login"
                className="h-[52px] px-8 flex items-center justify-center text-[15px] font-bold bg-[#D4FF4F] text-black rounded-[12px] hover:bg-[#c8f040] transition-colors duration-150 text-center"
              >
                Start free trial
              </Link>
              <a
                href="#features"
                className="h-[52px] px-8 flex items-center justify-center text-[15px] font-semibold text-white border border-white/20 rounded-[12px] hover:border-white/35 hover:bg-white/[0.04] transition-all duration-150 text-center"
              >
                See how it works
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3">
              <div className="flex">
                {[
                  { initials: 'TM', bg: 'bg-[#1a2e1a]', text: 'text-[#3dd68c]' },
                  { initials: 'GN', bg: 'bg-[#1a1e2e]', text: 'text-[#60a5fa]' },
                  { initials: 'FK', bg: 'bg-[#221a2e]', text: 'text-[#a78bfa]' },
                  { initials: 'SK', bg: 'bg-[#2e221a]', text: 'text-[#f5a623]' },
                ].map((av, i) => (
                  <div
                    key={av.initials}
                    className={`
                      w-[30px] h-[30px] rounded-full border-2 border-[#0C0C0C]
                      flex items-center justify-center text-[10px] font-bold
                      ${av.bg} ${av.text}
                      ${i > 0 ? '-ml-2.5' : ''}
                    `}
                  >
                    {av.initials}
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-white/35">
                <span className="text-white/60 font-semibold">Service businesses</span>
                {' '}across Africa trust Segmiq
              </p>
            </div>
          </div>

          {/* Right — dashboard mockup */}
          <div className="lg:pl-4">
            <div className="bg-[#141414] border border-white/[0.08] rounded-[20px] p-5 sm:p-6 overflow-hidden">

              {/* Dash top bar */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[13px] font-bold text-white/90">Your pipeline today</p>
                  <p className="text-[11px] text-white/30 mt-0.5">Thursday, 29 May 2026</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#3dd68c]" />
                  <span className="text-[11px] text-white/30">Live</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
                {[
                  { num: '24', label: 'Active leads', colour: 'text-[#D4FF4F]' },
                  { num: '71%', label: 'Contact rate', colour: 'text-[#3dd68c]' },
                  { num: '3', label: 'Won this week', colour: 'text-white' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#1e1e1e] rounded-[10px] p-3 sm:p-4">
                    <p
                      className={`text-[22px] sm:text-[26px] font-extrabold leading-none ${stat.colour} tracking-tight`}
                      style={{ fontFamily: 'Georgia, serif' }}
                    >
                      {stat.num}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-white/30 mt-1.5 uppercase tracking-wider font-semibold">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Priority leads label */}
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-white/25 mb-2.5">
                Priority leads
              </p>

              {/* Lead rows */}
              {[
                {
                  initials: 'TM',
                  name: 'Tendai Moyo',
                  sub: '5kW solar · Follow-up due today',
                  score: 86,
                  badgeText: 'Hot · 86',
                  avatarBg: 'bg-[#D4FF4F]/10',
                  avatarText: 'text-[#D4FF4F]',
                  badgeBg: 'bg-[#D4FF4F]/10 text-[#D4FF4F]',
                  barColour: '#D4FF4F',
                },
                {
                  initials: 'GN',
                  name: 'Grace Ndlovu',
                  sub: 'Roofing · Never called',
                  score: 74,
                  badgeText: 'New · 74',
                  avatarBg: 'bg-[#60a5fa]/10',
                  avatarText: 'text-[#60a5fa]',
                  badgeBg: 'bg-[#D4FF4F]/10 text-[#D4FF4F]',
                  barColour: '#60a5fa',
                },
                {
                  initials: 'FK',
                  name: 'Farai Khumalo',
                  sub: 'Construction · Last called 2d ago',
                  score: 61,
                  badgeText: 'Warm · 61',
                  avatarBg: 'bg-[#f5a623]/10',
                  avatarText: 'text-[#f5a623]',
                  badgeBg: 'bg-[#f5a623]/10 text-[#f5a623]',
                  barColour: '#f5a623',
                },
              ].map(lead => (
                <div
                  key={lead.name}
                  className="flex items-center gap-3 bg-[#1e1e1e] rounded-[10px] px-3 py-2.5 mb-2 last:mb-0"
                >
                  <div
                    className={`w-[32px] h-[32px] sm:w-[34px] sm:h-[34px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${lead.avatarBg} ${lead.avatarText}`}
                  >
                    {lead.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] sm:text-[13px] font-semibold text-white/90 truncate">
                      {lead.name}
                    </p>
                    <p className="text-[10px] text-white/30 truncate mt-0.5">
                      {lead.sub}
                    </p>
                    <div className="h-[3px] bg-white/[0.06] rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-[3px] rounded-full"
                        style={{ width: `${lead.score}%`, background: lead.barColour }}
                      />
                    </div>
                  </div>
                  <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-1 rounded-[6px] flex-shrink-0 ${lead.badgeBg}`}>
                    {lead.badgeText}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats strip — full width below hero */}
        <div className="mt-16 sm:mt-20 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] border border-white/[0.06] rounded-[16px] overflow-hidden">
          {[
            {
              num: '9×',
              label: 'Higher conversion rate when called within 5 minutes',
            },
            {
              num: '0',
              label: 'Data lost when a salesperson leaves the business',
            },
            {
              num: '1 tap',
              label: 'To send portfolio, pricing, or projects via WhatsApp',
            },
          ].map(stat => (
            <div key={stat.num} className="bg-[#0f0f0f] px-8 py-7 sm:py-8 text-center sm:text-left">
              <p
                className="text-[38px] sm:text-[42px] font-extrabold text-[#D4FF4F] leading-none tracking-tight mb-2"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {stat.num}
              </p>
              <p className="text-[13px] text-white/35 leading-[1.5] max-w-[200px] mx-auto sm:mx-0">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
