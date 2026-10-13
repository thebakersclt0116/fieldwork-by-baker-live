import { useEffect } from 'react';
import { measurePublicLanding } from '@/lib/acquisitionFunnel';
export default function PublicLandingMeasurement({ path }: { path: '/' | '/signup' }) {
  useEffect(() => {
    const report = () => { if (document.visibilityState === 'visible') void measurePublicLanding(path); };
    const frame = requestAnimationFrame(report);
    window.addEventListener('baker-ad-choice', report);
    document.addEventListener('visibilitychange', report);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('baker-ad-choice', report); document.removeEventListener('visibilitychange', report); };
  }, [path]);
  return null;
}
