export type ClassValue = string | number | null | false | undefined;

/** Minimal class-name joiner (no external deps). Filters falsy values. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
