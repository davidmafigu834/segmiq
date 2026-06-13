/**
 * Footer for blog.segmiq.com.
 */

export default function BlogFooter() {
  return (
    <footer className="border-t border-black/[0.10] py-8">
      <div className="mx-auto max-w-[1180px] px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-[#8a8a8a]">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center w-[22px] h-[22px] rounded-[6px] bg-[#D4FF4F] text-black font-extrabold text-[12px]">S</span>
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
