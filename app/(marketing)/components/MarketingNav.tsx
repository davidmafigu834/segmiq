'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function MarketingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <>
      <nav
        className={`
          sticky top-0 z-50 w-full transition-all duration-200
          ${scrolled
            ? 'bg-[#0C0C0C]/95 backdrop-blur-md border-b border-white/[0.07]'
            : 'bg-[#0C0C0C] border-b border-white/[0.07]'
          }
        `}
      >
        <div className="max-w-[1100px] mx-auto px-5 sm:px-8 lg:px-10">
          <div className="flex items-center justify-between h-[60px] lg:h-[66px]">

            {/* Logo */}
            <Link
              href="/"
              className="text-[#D4FF4F] font-extrabold text-[20px] lg:text-[22px] tracking-tight flex-shrink-0"
            >
              Segmiq
            </Link>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-7">
              {[
                { label: 'Platform', href: '#features' },
                { label: 'Intelligence', href: '#intelligence' },
                { label: 'Audiences', href: '#audiences' },
                { label: 'Pricing', href: '#pricing' },
                { label: 'Cloud', href: 'https://cloud.segmiq.com' },
              ].map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[13px] text-white/50 hover:text-white transition-colors duration-150 font-medium"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Desktop CTA buttons */}
            <div className="hidden lg:flex items-center gap-2.5">
              <Link
                href="/login"
                className="h-[36px] px-5 flex items-center text-[13px] font-semibold text-white/80 border border-white/[0.15] rounded-[8px] hover:border-white/30 hover:text-white transition-all duration-150"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="h-[36px] px-5 flex items-center text-[13px] font-bold bg-[#D4FF4F] text-black rounded-[8px] hover:bg-[#c8f040] transition-colors duration-150"
              >
                Get started free
              </Link>
            </div>

            {/* Mobile — CTA + hamburger */}
            <div className="flex lg:hidden items-center gap-2.5">
              <Link
                href="/login"
                className="h-[34px] px-4 flex items-center text-[12px] font-bold bg-[#D4FF4F] text-black rounded-[8px]"
              >
                Get started
              </Link>
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                className="w-[36px] h-[36px] flex flex-col items-center justify-center gap-[5px] rounded-[8px] border border-white/[0.12] hover:border-white/25 transition-colors"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                <span
                  className={`block w-[16px] h-[1.5px] bg-white/70 transition-all duration-200 origin-center ${
                    menuOpen ? 'rotate-45 translate-y-[6.5px]' : ''
                  }`}
                />
                <span
                  className={`block w-[16px] h-[1.5px] bg-white/70 transition-all duration-200 ${
                    menuOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`block w-[16px] h-[1.5px] bg-white/70 transition-all duration-200 origin-center ${
                    menuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        <div
          className={`
            lg:hidden overflow-hidden transition-all duration-300 border-t border-white/[0.06]
            ${menuOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="px-5 py-5 flex flex-col gap-1">
            {[
              { label: 'Platform', href: '#features' },
              { label: 'Intelligence', href: '#intelligence' },
              { label: 'Audiences', href: '#audiences' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'Segmiq Cloud', href: 'https://cloud.segmiq.com' },
            ].map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center h-[44px] px-3 text-[15px] font-medium text-white/60 hover:text-white hover:bg-white/[0.04] rounded-[8px] transition-all"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center h-[44px] w-full text-[14px] font-semibold text-white/70 border border-white/[0.12] rounded-[10px] hover:border-white/25 hover:text-white transition-all mb-2"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
