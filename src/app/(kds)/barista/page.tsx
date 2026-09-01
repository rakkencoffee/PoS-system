import { KdsView } from '@/components/kds/KdsView';
import { KdsAuthGate } from '@/components/kds/KdsAuthGate';
import { StationPrinterPanel } from '@/components/kds/StationPrinterPanel';

export default function BaristaPage() {
  return (
    <KdsAuthGate station="Barista">
      <KdsView
        type="barista"
        title="Barista Station"
        headerExtra={
          <StationPrinterPanel
            labelEndpointBase="/api/kds/sticker"
            emptyMessage="Tidak ada minuman di order ini."
          />
        }
      />
    </KdsAuthGate>
  );
}
