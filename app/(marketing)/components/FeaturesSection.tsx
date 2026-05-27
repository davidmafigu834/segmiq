export function FeaturesSection() {
  return (
    <section
      id="features"
      className="bg-[#0F0F0F] py-20 sm:py-24 lg:py-28 px-5 sm:px-8 lg:px-10"
    >
      <div className="max-w-[1100px] mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/30 mb-3">
          The platform
        </p>
        <h2 className="text-[32px] sm:text-[38px] lg:text-[44px] font-extrabold text-white leading-[1.1] tracking-tight mb-4">
          Everything your sales team needs.{' '}
          <span className="text-[#D4FF4F]">Nothing they don&apos;t.</span>
        </h2>
        <p className="text-[16px] text-white/40 leading-[1.75] max-w-[500px] mb-12 sm:mb-16">
          Built for construction, solar, roofing, electrical, and every
          trade business that sells a project worth closing.
        </p>

        <div className="flex flex-col gap-4">

          {/* Feature 1 — WhatsApp confirmation — full width */}
          <div className="bg-[#181818] border border-white/[0.07] rounded-[18px] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center hover:border-[#D4FF4F]/20 transition-colors duration-200">
            <div>
              <div className="inline-flex items-center gap-2 h-[24px] px-3 bg-[#D4FF4F]/10 rounded-[6px] text-[10px] font-bold text-[#D4FF4F] uppercase tracking-[0.06em] mb-4">
                Instant confirmation
              </div>
              <h3 className="text-[20px] sm:text-[22px] font-bold text-white/90 mb-3 leading-snug">
                Prospect gets a WhatsApp the second they submit
              </h3>
              <p className="text-[14px] text-white/40 leading-[1.7] mb-5">
                Before your salesperson even sees the lead, the prospect
                receives a personalised WhatsApp with their name, enquiry,
                portfolio link, and expected callback time. Leads stay warm
                automatically.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: '⚡', label: 'Sent within seconds' },
                  { icon: '👤', label: 'Personalised' },
                  { icon: '🔗', label: 'Includes portfolio' },
                ].map(pill => (
                  <div
                    key={pill.label}
                    className="flex items-center gap-2 px-3 py-2 bg-[#222] border border-white/[0.07] rounded-[10px] text-[12px] font-semibold text-white/55"
                  >
                    <span aria-hidden="true">{pill.icon}</span>
                    {pill.label}
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp mockup */}
            <div className="bg-[#202C33] rounded-[14px] p-5">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-white/[0.08]">
                <div className="w-[32px] h-[32px] rounded-full bg-[#D4FF4F]/15 flex items-center justify-center text-[11px] font-bold text-[#D4FF4F]">
                  SP
                </div>
                <div>
                  <p className="text-[12px] font-bold text-white/90">SunPower Solar</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#25d366]" />
                    <p className="text-[10px] text-white/30">online</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#005C4B] rounded-[10px] rounded-tl-[2px] p-3.5 text-[12px] text-[#e9edef] leading-[1.65] mb-2">
                Hi <strong>Tendai</strong>, thank you for reaching out to{' '}
                <strong>SunPower Solar</strong>.<br /><br />
                We have received your enquiry about{' '}
                <strong>5kW residential solar installation</strong> and
                our team will call you within{' '}
                <strong className="text-[#D4FF4F]">1 hour</strong>.<br /><br />
                View our projects:{' '}
                <span className="text-[#53bdeb]">segmiq.com/p/sunpower</span>
              </div>
              <p className="text-[10px] text-white/25 text-right mb-3">
                Delivered ✓✓ · just now
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#3dd68c]/10 border border-[#3dd68c]/20 rounded-[8px]">
                <div className="w-2 h-2 rounded-full bg-[#3dd68c] flex-shrink-0" />
                <p className="text-[11px] font-semibold text-[#3dd68c]">
                  Lead saved · Assigned to David · Score: 82
                </p>
              </div>
            </div>
          </div>

          {/* Feature 2 + 3 — two column on tablet+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* One-tap send */}
            <div className="bg-[#181818] border border-white/[0.07] rounded-[18px] p-6 sm:p-7 hover:border-[#D4FF4F]/20 transition-colors duration-200">
              <div className="inline-flex items-center gap-2 h-[24px] px-3 bg-[#D4FF4F]/10 rounded-[6px] text-[10px] font-bold text-[#D4FF4F] uppercase tracking-[0.06em] mb-4">
                One-tap send
              </div>
              <h3 className="text-[18px] font-bold text-white/90 mb-2.5 leading-snug">
                Send portfolio, pricing, and projects in one tap
              </h3>
              <p className="text-[13px] text-white/40 leading-[1.65] mb-5">
                From inside any lead tap Send and pick what to share.
                It goes to the prospect&apos;s WhatsApp in seconds. No
                hunting. No copying links.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Portfolio', colour: 'text-[#3dd68c]', bg: 'bg-[#1a2e1a] border-[#3dd68c]/15' },
                  { label: 'Project', colour: 'text-[#60a5fa]', bg: 'bg-[#1a1e2e] border-[#60a5fa]/15' },
                  { label: 'Pricing', colour: 'text-[#f5a623]', bg: 'bg-[#2a2a1a] border-[#f5a623]/15' },
                  { label: 'Document', colour: 'text-[#a78bfa]', bg: 'bg-[#221a2e] border-[#a78bfa]/15' },
                  { label: 'Custom', colour: 'text-white/50', bg: 'bg-[#222] border-white/[0.08]' },
                ].map(item => (
                  <span
                    key={item.label}
                    className={`px-3 py-2 border rounded-[10px] text-[12px] font-semibold ${item.colour} ${item.bg}`}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-[#181818] border border-white/[0.07] rounded-[18px] p-6 sm:p-7 hover:border-[#D4FF4F]/20 transition-colors duration-200">
              <div className="inline-flex items-center gap-2 h-[24px] px-3 bg-[#D4FF4F]/10 rounded-[6px] text-[10px] font-bold text-[#D4FF4F] uppercase tracking-[0.06em] mb-4">
                Lead timeline
              </div>
              <h3 className="text-[18px] font-bold text-white/90 mb-2.5 leading-snug">
                Complete history survives when salespeople leave
              </h3>
              <p className="text-[13px] text-white/40 leading-[1.65] mb-5">
                Every call, note, and document sent recorded forever.
                New salesperson assigned? They see everything — the
                relationship doesn&apos;t walk out with the person.
              </p>
              <div className="bg-[#111] rounded-[10px] p-4 flex flex-col gap-3">
                {[
                  { colour: 'bg-[#3dd68c]', text: 'David logged a call · Answered', sub: '"Interested in 5kW, wants quote by Friday" · 2h ago' },
                  { colour: 'bg-[#60a5fa]', text: 'Portfolio sent to prospect', sub: 'segmiq.com/p/sunpower · 3h ago' },
                  { colour: 'bg-[#D4FF4F]', text: 'Lead created · Facebook', sub: '5kW residential solar · Intent score 82 · Yesterday' },
                ].map(item => (
                  <div key={item.text} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.colour}`} />
                    <div>
                      <p className="text-[11px] font-semibold text-white/85">{item.text}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 4 — Conversational forms — full width */}
          <div className="bg-[#181818] border border-white/[0.07] rounded-[18px] p-6 sm:p-8 hover:border-[#D4FF4F]/20 transition-colors duration-200">
            <div className="inline-flex items-center gap-2 h-[24px] px-3 bg-[#D4FF4F]/10 rounded-[6px] text-[10px] font-bold text-[#D4FF4F] uppercase tracking-[0.06em] mb-4">
              Conversational forms
            </div>
            <h3 className="text-[20px] sm:text-[22px] font-bold text-white/90 mb-3 leading-snug max-w-[520px]">
              Lead forms that feel like a real conversation
            </h3>
            <p className="text-[14px] text-white/40 leading-[1.7] mb-7 max-w-[560px]">
              Replace the generic Facebook form with a chat-style
              interface. Questions appear one at a time. AI generates
              the right questions for your client&apos;s industry automatically.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { emoji: '✨', title: 'AI generates questions', sub: 'Per industry, per client', bg: 'bg-[#D4FF4F]/5 border-[#D4FF4F]/10' },
                { emoji: '📱', title: 'Mobile-first chat UI', sub: 'One question at a time', bg: 'bg-[#60a5fa]/5 border-[#60a5fa]/10' },
                { emoji: '🏢', title: 'Branded experience', sub: 'Logo, colours, tone', bg: 'bg-[#3dd68c]/5 border-[#3dd68c]/10' },
                { emoji: '🗄️', title: 'Maps to lead fields', sub: 'Data lands correctly', bg: 'bg-[#a78bfa]/5 border-[#a78bfa]/10' },
              ].map(item => (
                <div
                  key={item.title}
                  className={`border rounded-[12px] p-4 ${item.bg}`}
                >
                  <div className="text-[22px] mb-3" aria-hidden="true">{item.emoji}</div>
                  <p className="text-[12px] font-bold text-white/85 mb-1 leading-snug">{item.title}</p>
                  <p className="text-[11px] text-white/35">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
