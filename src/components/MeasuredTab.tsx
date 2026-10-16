import { useEffect, type ReactNode } from 'react';
import type { UsageFeature } from '@/lib/featureUsageSchema';
/** Mounted inside existing access guards. Contains no content inspection. */
export default function MeasuredTab({ feature, children }: { feature: UsageFeature; children: ReactNode }) {
  useEffect(() => { window.dispatchEvent(new Event('fieldwork:usage-tab-ready')); }, []);
  return <div data-usage-tab={feature}>{children}</div>;
}
