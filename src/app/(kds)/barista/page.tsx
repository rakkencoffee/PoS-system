import { KdsView } from '@/components/kds/KdsView';
import { KdsAuthGate } from '@/components/kds/KdsAuthGate';
import { BaristaPrinterPanel } from '@/components/kds/BaristaPrinterPanel';

export default function BaristaPage() {
  return (
    <KdsAuthGate station="Barista">
      <div className="fixed top-3 right-3 z-50">
        <BaristaPrinterPanel />
      </div>
      <KdsView type="barista" title="Barista Station" />
    </KdsAuthGate>
  );
}
