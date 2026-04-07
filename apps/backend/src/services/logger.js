/**
 * Structured logger for the DocuFlow pipeline.
 * Outputs JSON lines to stdout — compatible with Vercel logs and any log aggregator.
 */
function log(level, event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  }
  console.log(JSON.stringify(entry))
}

export const logger = {
  info:  (event, data) => log('INFO',  event, data),
  warn:  (event, data) => log('WARN',  event, data),
  error: (event, data) => log('ERROR', event, data),
}
