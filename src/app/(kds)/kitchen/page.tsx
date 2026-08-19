import { KdsView } from '@/components/kds/KdsView';
import { KdsAuth } from '@/components/kds/KdsAuth';

export default function KitchenPage() {
  return (
    <KdsAuth title="Kitchen Station">
      <KdsView type="kitchen" title="Kitchen Station" />
    </KdsAuth>
  );
}
