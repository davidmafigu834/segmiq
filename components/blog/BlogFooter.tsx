import Link from "next/link";
import SegmiqWordmark from "@/components/marketing/SegmiqWordmark";
import { BLOG_CATEGORY_NAV } from "@/lib/blog";
import { blogCategoryHref, blogHref } from "@/lib/blog-links";

export default function BlogFooter({ pathPrefix = "" }: { pathPrefix?: string }) {
  return (
    <footer className="border-t border-black/[0.10] dark:border-white/10 bg-[#0C0C0C] text-white mt-12">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-baseline gap-2">
              <SegmiqWordmark href={blogHref(pathPrefix, "/")} size="sm" theme="dark" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">Wire</span>
            </div>
            <p className="mt-4 text-[14px] text-white/55 leading-relaxed max-w-[280px]">
              Trade tech news for Africa — solar, construction, roofing, electrical, and landscaping.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 mb-4">Sections</h4>
            <nav className="space-y-2.5">
              {BLOG_CATEGORY_NAV.map(({ category, label }) => (
                <Link key={category} href={blogCategoryHref(category, pathPrefix)} className="block text-[14px] text-white/65 hover:text-white transition-colors">
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 mb-4">Segmiq</h4>
            <nav className="space-y-2.5">
              <a href="https://segmiq.com" className="block text-[14px] text-white/65 hover:text-white transition-colors">Product</a>
              <a href="https://segmiq.com/contact" className="block text-[14px] text-white/65 hover:text-white transition-colors">Book a demo</a>
              <Link href="/#subscribe" className="block text-[14px] text-white/65 hover:text-white transition-colors">Newsletter</Link>
            </nav>
          </div>

          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-white/40 mb-4">Legal</h4>
            <nav className="space-y-2.5">
              <a href="https://segmiq.com/privacy" className="block text-[14px] text-white/65 hover:text-white transition-colors">Privacy</a>
              <a href="https://segmiq.com/terms" className="block text-[14px] text-white/65 hover:text-white transition-colors">Terms</a>
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] text-white/40">
          <span>© {new Date().getFullYear()} Segmiq · blog.segmiq.com</span>
          <span>Built for trade businesses across Africa</span>
        </div>
      </div>
    </footer>
  );
}
