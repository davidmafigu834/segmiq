import Image from "next/image";
import Link from "next/link";
import SegmiqMark from "@/components/brand/SegmiqMark";

const SIZES = {
  sm: { width: 120, height: 20, className: "h-5 w-auto", mark: 22 },
  md: { width: 150, height: 24, className: "h-6 w-auto", mark: 28 },
} as const;

const SRC = {
  dark: "/segmiq-wordmark.png",
  light: "/segmiq-wordmark-black.png",
} as const;

type SegmiqWordmarkProps = {
  href?: string;
  size?: keyof typeof SIZES;
  priority?: boolean;
  /** dark = white wordmark; light = black wordmark; auto = switches with site dark mode */
  theme?: keyof typeof SRC | "auto";
  /** Show the Q brand mark next to the wordmark (default true) */
  showMark?: boolean;
};

export default function SegmiqWordmark({
  href = "/",
  size = "md",
  priority = false,
  theme = "dark",
  showMark = true,
}: SegmiqWordmarkProps) {
  const { width, height, className, mark } = SIZES[size];

  const image =
    theme === "auto" ? (
      <>
        <Image
          src={SRC.light}
          alt="Segmiq"
          width={width}
          height={height}
          className={`${className} dark:hidden`}
          priority={priority}
        />
        <Image
          src={SRC.dark}
          alt="Segmiq"
          width={width}
          height={height}
          className={`${className} hidden dark:block`}
          priority={priority}
        />
      </>
    ) : (
      <Image
        src={SRC[theme]}
        alt="Segmiq"
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    );

  const content = (
    <span className="inline-flex shrink-0 items-center gap-2">
      {showMark ? <SegmiqMark size={mark} priority={priority} /> : null}
      {image}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {content}
    </Link>
  );
}
