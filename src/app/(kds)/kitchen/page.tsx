import { KdsView } from '@/components/kds/KdsView';
import { KdsAuthGate } from '@/components/kds/KdsAuthGate';
import { StationPrinterPanel } from '@/components/kds/StationPrinterPanel';

export default function KitchenPage() {
  return (
    <KdsAuthGate station="Kitchen">
      <KdsView
        type="kitchen"
        title="Kitchen Station"
        headerExtra={
          <StationPrinterPanel
            labelEndpointBase="/api/kds/food-label"
            emptyMessage="Tidak ada makanan di order ini."
          />
        }
      />
    </KdsAuthGate>
  );
}
