import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const prose =
  "space-y-5 text-[17px] leading-[1.7] text-white/80 [&_h2]:text-white [&_h2]:text-[26px] [&_h2]:font-extrabold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-white [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-2 [&_img]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-[#D4FF4F] [&_blockquote]:pl-4 [&_blockquote]:italic";

const proseDark =
  "space-y-4 text-[14px] leading-[1.7] text-[var(--text-primary)] [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-[var(--accent)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--accent)] [&_blockquote]:pl-4 [&_blockquote]:italic";

const proseBlog =
  "[&_p]:text-[17px] [&_p]:leading-[1.75] [&_p]:text-[#222] [&_p]:mt-5 [&_h2]:text-[24px] [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-2 [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:mt-8 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mt-4 [&_li]:mt-1.5 [&_li]:text-[17px] [&_li]:text-[#222] [&_a]:underline [&_a]:text-black [&_blockquote]:border-l-2 [&_blockquote]:border-[#D4FF4F] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#444] [&_blockquote]:my-6";

export function BlogMarkdown({ body, variant = "marketing" }: { body: string; variant?: "marketing" | "portal" | "blog" }) {
  const cls = variant === "portal" ? proseDark : variant === "blog" ? proseBlog : prose;
  return (
    <div className={cls}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
