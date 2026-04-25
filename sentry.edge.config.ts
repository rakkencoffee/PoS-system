import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "https://bedd9bc292ae7d644aae6d362677d8c6@o4511267465723904.ingest.us.sentry.io/4511267473719296",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // Enable Logs for better debug visibility
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
