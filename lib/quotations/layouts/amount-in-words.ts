const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function chunk(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`;
  return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${chunk(n % 100)}` : ""}`;
}

function intWords(n: number): string {
  if (n === 0) return "zero";
  const scales = [
    { v: 1_000_000_000, w: "billion" },
    { v: 1_000_000, w: "million" },
    { v: 1_000, w: "thousand" },
  ];
  const parts: string[] = [];
  let rest = n;
  for (const s of scales) {
    if (rest >= s.v) {
      parts.push(`${intWords(Math.floor(rest / s.v))} ${s.w}`);
      rest %= s.v;
    }
  }
  if (rest) parts.push(chunk(rest));
  return parts.join(" ");
}

/** Reliable integer + cents wording. Returns null if the amount is not a finite number. */
export function amountInWords(amount: number, currency: string): string | null {
  if (!Number.isFinite(amount)) return null;
  const abs = Math.abs(Math.round(amount * 100) / 100);
  const major = Math.floor(abs);
  const cents = Math.round((abs - major) * 100);
  const code = (currency || "USD").toUpperCase();
  const head = intWords(major);
  const money = `${head} ${code}`;
  if (!cents) return `${money} only`;
  return `${money} and ${String(cents).padStart(2, "0")}/100`;
}
