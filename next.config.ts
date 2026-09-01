import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default withSentryConfig(withPWA(nextConfig), {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: "rakken-coffee",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Anonymous plugin-usage telemetry Sentry sends about itself (separate from
  // actual sourcemap upload) -- disabled 2026-09-01 after it hung the build
  // indefinitely at "Sending telemetry data..." both locally and on Vercel,
  // apparently a transient Sentry-side outage. No reason to let an optional
  // stats call block every deploy if it happens again.
  telemetry: false,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // TEMP 2026-09-01: sourcemap upload (a network call to Sentry's API) is
  // hanging the build indefinitely today, same outage as the telemetry call
  // above -- disabling entirely to unblock deploys. Only cost is worse
  // (minified) stack traces in the Sentry dashboard, error tracking itself
  // still works. Re-enable (delete this `disable` line) once Sentry's own
  // service is confirmed healthy again.
  sourcemaps: {
    disable: true,
    deleteSourcemapsAfterUpload: true,
  },

  // Enables automatic instrumentation of Vercel Cron Monitors. 
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,

  // Note: Re-enabling tunnelRoute to bypass DNS blocking (ERR_NAME_NOT_RESOLVED)
  // Next.js rewrites for Sentry Tunnel are now placed correctly in SDK options
  tunnelRoute: "/sentry-tunnel",
});
