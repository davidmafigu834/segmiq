/**
 * Footer for blog.segmiq.com.
 */

import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";

export default function BlogFooter() {
  return (
    <footer className="border-t border-black/[0.10] py-8">
      <div className="mx-auto max-w-[1180px] px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[#8a8a8a]">
        <div className="flex items-center gap-3">
          <SegmiqWordmark href="/" size="sm" />
          <span>© {new Date().getFullYear()} Segmiq Blog · blog.segmiq.com</span>
        </div>
        <div className="flex gap-5">
          <a href="https://segmiq.com" className="hover:text-black">segmiq.com</a>
          <a href="https://segmiq.com/privacy" className="hover:text-black">Privacy</a>
          <a href="https://segmiq.com/terms" className="hover:text-black">Terms</a>
        </div>
      </div>
    </footer>
  );
}
