/** Remove HTML tags for SMS-style previews (scraped listing text sometimes leaks in). */
export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
