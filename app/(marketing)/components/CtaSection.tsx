import Link from 'next/link';

export function CtaSection() {
  return (
    <section className="bg-[#D4FF4F] py-20 sm:py-24 lg:py-28 px-5 sm:px-8 lg:px-10">
      <div className="max-w-[680px] mx-auto text-center">
        <h2 className="text-[36px] sm:text-[46px] lg:text-[54px] font-extrabold text-black leading-[1.08] tracking-[-1px] mb-5">
          Your leads are ready.
          <br />
          Is your team?
        </h2>
        <p className="text-[16px] sm:text-[17px] text-black/50 leading-[1.7] mb-10 max-w-[480px] mx-auto">
          Start a free trial today. No credit card required. Your first
          client is live in under 30 minutes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="w-full sm:w-auto h-[52px] px-10 flex items-center justify-center text-[15px] font-bold bg-black text-[#D4FF4F] rounded-[12px] hover:bg-[#111] transition-colors duration-150"
          >
            Start free trial
          </Link>
          <a
            href="mailto:hello@segmiq.com"
            className="w-full sm:w-auto h-[52px] px-10 flex items-center justify-center text-[15px] font-bold text-black border-[1.5px] border-black/20 rounded-[12px] hover:border-black/40 transition-colors duration-150"
          >
            Talk to us
          </a>
        </div>
      </div>
    </section>
  );
}
