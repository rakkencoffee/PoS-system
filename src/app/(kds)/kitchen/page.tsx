'use client';

import { useCallback } from 'react';
import { KdsView } from '@/components/kds/KdsView';
import { KdsAuthGate } from '@/components/kds/KdsAuthGate';
import { StationPrinterPanel } from '@/components/kds/StationPrinterPanel';
import { useBlePrinter } from '@/hooks/useBlePrinter';
import { printStationLabel } from '@/lib/print/station-print';

const LABEL_ENDPOINT_BASE = '/api/kds/food-label';
const TEST_ENDPOINT = '/api/kds/food-label-test';

export default function KitchenPage() {
  // Lifted here (not inside StationPrinterPanel) so the manual "Print Label"
  // button on each KdsView order card shares the same BLE connection as the
  // header's auto-print panel, instead of each holding its own.
  const { connected, deviceName, connect, disconnect, writeBytes } = useBlePrinter();

  const handlePrintLabel = useCallback(async (orderId: string): Promise<string> => {
    try {
      const { message } = await printStationLabel(LABEL_ENDPOINT_BASE, orderId, writeBytes);
      return message;
    } catch (err) {
      return `Gagal: ${err instanceof Error ? err.message : String(err)}`;
    }
  }, [writeBytes]);

  return (
    <KdsAuthGate station="Kitchen">
      <KdsView
        type="kitchen"
        title="Kitchen Station"
        printerConnected={connected}
        onPrintLabel={handlePrintLabel}
        headerExtra={
          <StationPrinterPanel
            labelEndpointBase={LABEL_ENDPOINT_BASE}
            testEndpoint={TEST_ENDPOINT}
            emptyMessage="Tidak ada makanan di order ini."
            connected={connected}
            deviceName={deviceName}
            connect={connect}
            disconnect={disconnect}
            writeBytes={writeBytes}
          />
        }
      />
    </KdsAuthGate>
  );
}
