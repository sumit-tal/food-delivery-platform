/**
 * slugify generates a URL-friendly slug from a name.
 */
export function slugify(input: string): string {
  const lower = input.toLowerCase();
  const replaced = lower.replace(/[^a-z0-9]+/g, '-');
  const collapsed = replaced.replace(/-+/g, '-');
  const trimmed = collapsed.replace(/^-|-$/g, '');
  return trimmed;
}
