import { KdsView } from '@/components/kds/KdsView';
import { KdsAuth } from '@/components/kds/KdsAuth';

export default function BaristaPage() {
  return (
    <KdsAuth title="Barista Station">
      <KdsView type="barista" title="Barista Station" />
    </KdsAuth>
  );
}
