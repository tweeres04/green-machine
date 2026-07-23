import * as Sentry from "@sentry/remix";

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1,
    enableLogs: true
})