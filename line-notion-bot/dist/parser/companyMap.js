const BRAND_TO_COMPANY = {
    FLUKE: "Yangtai",
    RAYTEK: "Yangtai",
    E3MH: "Yangtai",
    OPTRIS: "RedDot",
    OPX: "RedDot"
};
export function inferCompany(text, lastCompany) {
    if (text.includes("洋泰") || text.toLowerCase().includes("yangtai"))
        return "Yangtai";
    if (text.includes("紅點") || text.toLowerCase().includes("reddot"))
        return "RedDot";
    const upper = text.toUpperCase();
    for (const [k, v] of Object.entries(BRAND_TO_COMPANY)) {
        if (upper.includes(k))
            return v;
    }
    return lastCompany;
}
