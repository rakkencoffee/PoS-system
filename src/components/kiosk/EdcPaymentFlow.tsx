'use client';

import { useEffect, useRef } from 'react';

type EdcJobStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'CANCELLED';

interface EdcJobStatusResponse {
  status: EdcJobStatus | 'NOT_FOUND';
  errorMessage?: string | null;
}

interface EdcPaymentFlowProps {
  orderId: string;
  amount: number;
  method?: 'CARD' | 'QRIS';
  onApproved: () => void;
  onCancel: () => void;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 3 * 60 * 1000; // 3 minutes — EDC waits for card tap/insert/swipe

// GenerateQris()'s own COMStatus() is documented as unreliable (see
// EdcDaemon.cs) -- it can report FAILED even though the customer completes
// payment on the physical terminal moments later. Cancelling (and voiding in
// Olsera) the instant FAILED/REJECTED is read raced that window and orphaned
// a genuinely-paid order with no printed nota/label (confirmed live
// 2026-09-2x). Instead of cancelling immediately, keep polling for this long
// after the first FAILED/REJECTED read in case a late APPROVED still lands --
// closes the race without needing staff to intervene for the common case
// (order genuinely abandoned) either, just delays that outcome.
const CANCEL_GRACE_PERIOD_MS = 20 * 1000;

// Renders nothing (2026-09-15): the kiosk used to show its own full-screen
// "Scan QR di layar mesin EDC" / failure+retry overlay here, but that
// duplicated -- and sometimes visually competed with -- the EDC's own native
// Windows dialogs (Initialize EDC communicate / Please check EDC display /
// Error response from Host), which the customer or staff may need to see and
// dismiss directly on the PC screen regardless of what this component shows.
// Decision: stop trying to hide or duplicate those dialogs, let them be the
// single source of payment-status feedback. This component now only runs
// the polling/approval logic in the background (EdcPaymentAnimation, only
// ever used by the deleted "waiting" UI, was removed along with it).
export function EdcPaymentFlow({ orderId, onApproved, onCancel }: EdcPaymentFlowProps) {
  const stopPollingRef = useRef(false);
  const hasApprovedRef = useRef(false);

  const handleApproved = () => {
    if (hasApprovedRef.current) return; // poll() and the Pusher push can both fire
    hasApprovedRef.current = true;
    onApproved();
  };

  const poll = async () => {
    stopPollingRef.current = false;

    const startTime = Date.now();
    // Set the moment a FAILED/REJECTED/CANCELLED read first happens; cleared
    // if the status ever recovers to something in-flight again. `onCancel()`
    // only actually fires once this deadline passes without an APPROVED
    // showing up -- see CANCEL_GRACE_PERIOD_MS above.
    let graceDeadline: number | null = null;

    while (!stopPollingRef.current && Date.now() - startTime < MAX_POLL_TIME_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (stopPollingRef.current) return;

      try {
        const res = await fetch(`/api/edc-jobs/status?orderId=${orderId}`);
        if (!res.ok) continue;
        const data: EdcJobStatusResponse = await res.json();

        if (data.status === 'APPROVED') {
          handleApproved();
          return;
        }
        if (data.status === 'REJECTED' || data.status === 'FAILED' || data.status === 'CANCELLED') {
          if (graceDeadline === null) {
            console.warn(
              `[EdcPaymentFlow] Job ${data.status.toLowerCase()}, waiting ${CANCEL_GRACE_PERIOD_MS / 1000}s for a possible late approval before cancelling:`,
              data.errorMessage
            );
            graceDeadline = Date.now() + CANCEL_GRACE_PERIOD_MS;
          } else if (Date.now() >= graceDeadline) {
            // Raw EDC/DLL error stays in the console for staff -- there's no
            // customer-facing message anymore, the EDC's own native dialog
            // (left unhidden/unclicked on purpose, see comment above) is what
            // communicates this now. Fall back to the checkout screen so the
            // customer can tap pay again themselves.
            console.warn('[EdcPaymentFlow] No approval after grace period, cancelling.');
            onCancel();
            return;
          }
          continue;
        }
        // PENDING / PROCESSING / NOT_FOUND — keep polling, and drop any grace
        // window in progress since the status is back to in-flight.
        graceDeadline = null;
      } catch {
        // transient network hiccup — keep polling
      }
    }

    if (!stopPollingRef.current) onCancel();
  };

  useEffect(() => {
    poll();
    return () => {
      stopPollingRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Independent of poll() -- which exits permanently on the first
  // FAILED/REJECTED read -- so staff flipping a job to APPROVED afterward
  // via ResolveEdcJob.ps1 (once they've confirmed the physical EDC receipt)
  // still reaches this tab instantly.
  useEffect(() => {
    let channel: ReturnType<import('pusher-js').default['subscribe']> | null = null;
    let pusher: import('pusher-js').default | null = null;

    (async () => {
      const { getPusherClient } = await import('@/lib/pusher');
      pusher = getPusherClient();
      channel = pusher.subscribe(`edc-job-${orderId}`);
      channel.bind('STATUS_UPDATE', (data: { status: EdcJobStatus }) => {
        if (data.status === 'APPROVED') handleApproved();
      });
    })();

    return () => {
      channel?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return null;
}
