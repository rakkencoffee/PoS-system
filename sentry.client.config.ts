import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "https://bedd9bc292ae7d644aae6d362677d8c6@o4511267465723904.ingest.us.sentry.io/4511267473719296";

Sentry.init({
  dsn: SENTRY_DSN,

  // IMPORTANT: Set debug to true to see if Sentry fails to send data in your browser console
  debug: true,

  tracesSampleRate: 1.0,

  // Temporarily disable Replay to ensure basic error reporting is stable
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,

  // Use the tunnel route to circumvent ad-blockers and DNS filters
  tunnel: "/sentry-tunnel",
});
