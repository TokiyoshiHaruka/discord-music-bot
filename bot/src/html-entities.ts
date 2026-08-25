const HTML_ENTITY_VALUES = {
  amp: "&",
  quot: '"',
  "#39": "'",
  apos: "'",
  lt: "<",
  gt: ">"
} as const;

const HTML_ENTITY_PATTERN = /&(amp|quot|#39|apos|lt|gt);/g;

export function decodeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY_PATTERN, (_match, name: string) => {
    return HTML_ENTITY_VALUES[name as keyof typeof HTML_ENTITY_VALUES];
  });
}
