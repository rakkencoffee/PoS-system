// Sentry is already initialized by sentry.client.config.ts (loaded
// automatically by @sentry/nextjs) — this used to also call Sentry.init()
// manually here with hardcoded debug:true/tracesSampleRate:1.0, which ran
// AFTER the real config and silently overrode it back to full verbosity
// and 100% tracing on every client mount.
export default function SentryProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
