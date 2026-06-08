import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const prose =
  "space-y-5 text-[17px] leading-[1.7] text-white/80 [&_h2]:text-white [&_h2]:text-[26px] [&_h2]:font-extrabold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-white [&_h3]:text-[20px] [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-2 [&_img]:rounded-xl [&_blockquote]:border-l-4 [&_blockquote]:border-[#D4FF4F] [&_blockquote]:pl-4 [&_blockquote]:italic";

const proseDark =
  "space-y-4 text-[14px] leading-[1.7] text-[var(--text-primary)] [&_h2]:text-[20px] [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-[var(--accent)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--accent)] [&_blockquote]:pl-4 [&_blockquote]:italic";

export function BlogMarkdown({ body, variant = "marketing" }: { body: string; variant?: "marketing" | "portal" }) {
  return (
    <div className={variant === "portal" ? proseDark : prose}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
    </div>
  );
}
