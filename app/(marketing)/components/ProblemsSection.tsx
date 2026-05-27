type Problem = {
  iconBg: string;
  iconColour: string;
  icon: string;
  title: string;
  body: string;
};

const PROBLEMS: Problem[] = [
  {
    iconBg: 'bg-orange-50',
    iconColour: 'text-orange-500',
    icon: '⏱',
    title: 'Leads go cold before the first call',
    body: 'Your team calls leads hours after they submit. By then the prospect has already spoken to a competitor who was faster.',
  },
  {
    iconBg: 'bg-pink-50',
    iconColour: 'text-pink-600',
    icon: '👤',
    title: 'Salespeople leave with all your data',
    body: 'When a rep leaves they take the WhatsApp history, the relationships, and knowledge of every deal. The new hire starts from zero.',
  },
  {
    iconBg: 'bg-blue-50',
    iconColour: 'text-blue-600',
    icon: '📊',
    title: 'No visibility into performance',
    body: 'You manage by gut feel. No idea which salesperson is performing, which source converts, or why deals are being lost.',
  },
  {
    iconBg: 'bg-purple-50',
    iconColour: 'text-purple-600',
    icon: '📁',
    title: 'Sending documents is slow and messy',
    body: 'Prospects ask for pricing or brochures. The rep spends 10 minutes hunting through Google Drive to find and send the right file.',
  },
  {
    iconBg: 'bg-green-50',
    iconColour: 'text-green-600',
    icon: '📢',
    title: 'Ad spend produces cheap leads, not buyers',
    body: 'Optimising for cheap leads gets you people who never answer the phone. You keep spending and keep getting the wrong audience.',
  },
  {
    iconBg: 'bg-yellow-50',
    iconColour: 'text-yellow-600',
    icon: '📋',
    title: 'Lead forms feel like government applications',
    body: 'Generic forms feel cold. Prospects drop off before finishing. The ones who submit feel like they sent their request into a void.',
  },
];

export function ProblemsSection() {
  return (
    <section
      id="problems"
      className="bg-[#F8F7F4] py-20 sm:py-24 lg:py-28 px-5 sm:px-8 lg:px-10"
    >
      <div className="max-w-[1100px] mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/35 mb-3">
          The problem
        </p>
        <h2 className="text-[32px] sm:text-[38px] lg:text-[44px] font-extrabold text-[#111] leading-[1.1] tracking-tight mb-4">
          Service businesses lose revenue{' '}
          <span className="bg-[#D4FF4F] px-1">the same way every time</span>
        </h2>
        <p className="text-[16px] text-black/45 leading-[1.75] max-w-[500px] mb-12 sm:mb-16">
          Facebook leads come in. Nobody calls fast enough. Salespeople
          leave with everything. Owners have no idea what is happening.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {PROBLEMS.map(prob => (
            <div
              key={prob.title}
              className="bg-white border border-black/[0.06] rounded-[16px] p-6 sm:p-7 hover:border-black/[0.12] transition-colors duration-200"
            >
              <div
                className={`w-[44px] h-[44px] rounded-[12px] flex items-center justify-center text-[22px] mb-5 ${prob.iconBg}`}
                aria-hidden="true"
              >
                {prob.icon}
              </div>
              <h3 className="text-[15px] font-bold text-[#111] mb-2.5 leading-snug">
                {prob.title}
              </h3>
              <p className="text-[13px] text-black/45 leading-[1.65]">
                {prob.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
