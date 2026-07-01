import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const prose =
  "space-y-5 text-[17px] leading-[1.7] text-white/80 [&_h2]:text-white [&_h2]:text-[26px] [&_h2]:font-extrabold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-white [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-2 [&_img]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-[#D4FF4F] [&_blockquote]:pl-4 [&_blockquote]:italic";

const proseDark =
  "space-y-4 text-[14px] leading-[1.7] text-[var(--text-primary)] [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-[var(--accent)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--accent)] [&_blockquote]:pl-4 [&_blockquote]:italic";

const proseBlog =
  "[&_p]:text-[18px] [&_p]:leading-[1.8] [&_p]:text-[#1a1a1a] dark:[&_p]:text-white/85 [&_p]:mt-6 [&_p:first-child]:mt-0 [&_h2]:text-[26px] [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:pt-2 [&_h2]:border-t [&_h2]:border-black/[0.08] dark:[&_h2]:border-white/10 [&_h2:first-of-type]:border-0 [&_h2:first-of-type]:pt-0 [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mt-4 [&_li]:mt-2 [&_li]:text-[18px] [&_li]:text-[#1a1a1a] dark:[&_li]:text-white/85 [&_li]:leading-[1.75] [&_a]:underline [&_a]:underline-offset-2 [&_a]:text-[#0C0C0C] dark:[&_a]:text-[#D4FF4F] [&_a]:font-medium [&_strong]:font-bold [&_em]:italic [&_code]:text-[15px] [&_code]:bg-[#FAFAF8] dark:[&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_pre]:bg-[#0C0C0C] [&_pre]:text-white/90 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-6 [&_blockquote]:border-l-4 [&_blockquote]:border-[#D4FF4F] [&_blockquote]:pl-5 [&_blockquote]:italic [&_blockquote]:text-[#444] dark:[&_blockquote]:text-white/65 [&_blockquote]:my-8 [&_blockquote]:text-[19px] [&_hr]:my-10 [&_hr]:border-black/[0.08] dark:[&_hr]:border-white/10";

export function BlogMarkdown({ body, variant = "marketing" }: { body: string; variant?: "marketing" | "portal" | "blog" }) {
  const cls = variant === "portal" ? proseDark : variant === "blog" ? proseBlog : prose;
  return (
    <div className={cls}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
