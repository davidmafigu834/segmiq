import Image from "next/image";

const SRC = "/brand/segmiq-q.png";

const SIZES = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 32,
  xl: 40,
} as const;

type SegmiqMarkProps = {
  size?: keyof typeof SIZES | number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

/** Segmiq Q brand mark — neon wireframe icon on black. */
export default function SegmiqMark({
  size = "md",
  className = "",
  priority = false,
  alt = "Segmiq",
}: SegmiqMarkProps) {
  const px = typeof size === "number" ? size : SIZES[size];

  return (
    <Image
      src={SRC}
      alt={alt}
      width={px}
      height={px}
      priority={priority}
      className={`shrink-0 rounded-[22%] object-cover ${className}`}
    />
  );
}

export { SRC as SEGMIQ_MARK_SRC };
