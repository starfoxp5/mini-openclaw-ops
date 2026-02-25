export function getTitle(page, key) {
    return page?.properties?.[key]?.title?.[0]?.plain_text ?? "";
}
export function getSelect(page, key) {
    return page?.properties?.[key]?.select?.name ?? "";
}
export function getRichText(page, key) {
    return page?.properties?.[key]?.rich_text?.[0]?.plain_text ?? "";
}
export function getNumber(page, key) {
    return page?.properties?.[key]?.number ?? 0;
}
