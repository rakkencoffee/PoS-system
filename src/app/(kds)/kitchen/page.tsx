import { KdsView } from '@/components/kds/KdsView';
import { KdsAuthGate } from '@/components/kds/KdsAuthGate';

export default function KitchenPage() {
  return (
    <KdsAuthGate station="Kitchen">
      <KdsView type="kitchen" title="Kitchen Station" />
    </KdsAuthGate>
  );
}
