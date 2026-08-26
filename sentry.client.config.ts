import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "https://bedd9bc292ae7d644aae6d362677d8c6@o4511267465723904.ingest.us.sentry.io/4511267473719296";

Sentry.init({
  dsn: SENTRY_DSN,

  // Verbose Sentry internals logging — leave off in production, it dumps
  // hundreds of console lines on every pageload and adds real main-thread
  // overhead during page load. Flip to true locally if Sentry setup needs
  // debugging again.
  debug: false,

  // Kiosk polls several endpoints on tight intervals (KDS, print status) —
  // tracing 100% of that burns through Sentry quota on repetitive noise.
  tracesSampleRate: 0.1,

  // Enable Logs for better debug visibility
  enableLogs: true,
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],

  // Temporarily disable Replay to ensure basic error reporting is stable
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,

  // Use the tunnel route to circumvent ad-blockers and DNS filters
  tunnel: "/sentry-tunnel",
});
