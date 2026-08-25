export function chunkText(text: string, size = 800, overlap = 80): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > size && current) {
      chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlap)) + "\n\n" + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, 80);
}
