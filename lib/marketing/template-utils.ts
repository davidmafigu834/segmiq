export function countBodyVariables(body: string): number {
  return (body.match(/\{\{\d+\}\}/g) ?? []).length;
}
