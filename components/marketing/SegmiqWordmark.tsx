import Image from "next/image";
import Link from "next/link";

const SIZES = {
  sm: { width: 120, height: 20, className: "h-5 w-auto" },
  md: { width: 150, height: 24, className: "h-6 w-auto" },
} as const;

type SegmiqWordmarkProps = {
  href?: string;
  size?: keyof typeof SIZES;
  priority?: boolean;
};

export default function SegmiqWordmark({
  href = "/",
  size = "md",
  priority = false,
}: SegmiqWordmarkProps) {
  const { width, height, className } = SIZES[size];

  const image = (
    <Image
      src="/segmiq-wordmark.png"
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
