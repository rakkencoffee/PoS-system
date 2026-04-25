'use client';

import { useEffect } from 'react';
import * as Sentry from "@sentry/nextjs";

export default function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // This only runs on the client
    if (typeof window !== 'undefined') {
      const dsn = "https://bedd9bc292ae7d644aae6d362677d8c6@o4511267465723904.ingest.us.sentry.io/4511267473719296";
      
      console.log('[Sentry Init] Initializing manually via SentryProvider');
      
      Sentry.init({
        dsn: dsn,
        debug: true,
        tracesSampleRate: 1.0,
        replaysOnErrorSampleRate: 0,
        replaysSessionSampleRate: 0,
        tunnel: "/sentry-tunnel",
        enableLogs: true,
        integrations: [
          Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
        ],
      });
    }
  }, []);

  return <>{children}</>;
}
