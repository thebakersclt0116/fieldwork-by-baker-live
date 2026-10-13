import { useState } from 'react';
import { Navigate } from 'react-router';
import { acquisitionDestination } from '@/lib/acquisitionFunnel';
export default function AcquisitionStart() {
  const [destination] = useState(acquisitionDestination);
  return <Navigate to={destination} replace />;
}
