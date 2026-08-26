import Image from "next/image";
import Link from "next/link";

const SIZES = {
  sm: { width: 120, height: 20, className: "h-5 w-auto" },
  md: { width: 150, height: 24, className: "h-6 w-auto" },
  /** Nav / footer lockup — source is 400×100 */
  lg: { width: 176, height: 44, className: "h-8 w-auto sm:h-9" },
  xl: { width: 208, height: 52, className: "h-10 w-auto sm:h-11" },
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
};

export default function SegmiqWordmark({
  href = "/",
  size = "md",
  priority = false,
  theme = "dark",
}: SegmiqWordmarkProps) {
  const { width, height, className } = SIZES[size];

  const image =
    theme === "auto" ? (
      <>
        <Image
          src={SRC.light}
          alt="Segmiq"
          width={width}
          height={height}
          className={`${className} marketing-wordmark-light dark:hidden`}
          priority={priority}
        />
        <Image
          src={SRC.dark}
          alt="Segmiq"
          width={width}
          height={height}
          className={`${className} marketing-wordmark-dark hidden dark:block`}
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

  if (!href) return <span className="inline-flex shrink-0 items-center">{image}</span>;

  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      {image}
    </Link>
  );
}
