const metrics = {
    startedAt: new Date().toISOString(),
    webhookEvents: 0,
    processedEvents: 0,
    errors: 0,
    restartEvents: 0
};
export function markWebhookEvent() {
    metrics.webhookEvents += 1;
    metrics.lastWebhookAt = new Date().toISOString();
}
export function markProcessedEvent() {
    metrics.processedEvents += 1;
}
export function markError() {
    metrics.errors += 1;
}
export function markRestartEvent() {
    metrics.restartEvents += 1;
}
export function markCronRun() {
    metrics.lastCronAt = new Date().toISOString();
}
export function getMetrics() {
    return { ...metrics };
}
