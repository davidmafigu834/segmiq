import Image from "next/image";
import Link from "next/link";

const SIZES = {
  sm: { width: 120, height: 20, className: "h-5 w-auto" },
  md: { width: 150, height: 24, className: "h-6 w-auto" },
} as const;

const SRC = {
  dark: "/segmiq-wordmark.png",
  light: "/segmiq-wordmark-black.png",
} as const;

type SegmiqWordmarkProps = {
  href?: string;
  size?: keyof typeof SIZES;
  priority?: boolean;
  /** dark = white wordmark on black tile (marketing); light = black wordmark for white backgrounds (blog) */
  theme?: keyof typeof SRC;
};

export default function SegmiqWordmark({
  href = "/",
  size = "md",
  priority = false,
  theme = "dark",
}: SegmiqWordmarkProps) {
  const { width, height, className } = SIZES[size];

  const image = (
    <Image
      src={SRC[theme]}
      alt="Segmiq"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );

  if (!href) return image;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {image}
    </Link>
  );
}
