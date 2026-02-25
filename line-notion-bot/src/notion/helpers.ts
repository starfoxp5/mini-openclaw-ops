export function getTitle(page: any, key: string): string {
  return page?.properties?.[key]?.title?.[0]?.plain_text ?? "";
}

export function getSelect(page: any, key: string): string {
  return page?.properties?.[key]?.select?.name ?? "";
}

export function getRichText(page: any, key: string): string {
  return page?.properties?.[key]?.rich_text?.[0]?.plain_text ?? "";
}

export function getNumber(page: any, key: string): number {
  return page?.properties?.[key]?.number ?? 0;
}
