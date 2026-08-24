import { KdsView } from '@/components/kds/KdsView';
import { KdsAuthGate } from '@/components/kds/KdsAuthGate';

export default function BaristaPage() {
  return (
    <KdsAuthGate station="Barista">
      <KdsView type="barista" title="Barista Station" />
    </KdsAuthGate>
  );
}
