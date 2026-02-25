const mem = new Map();
export function getLastCompany(userId) {
    return mem.get(userId);
}
export function setLastCompany(userId, company) {
    mem.set(userId, company);
}
