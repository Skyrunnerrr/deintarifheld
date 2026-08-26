import { Suspense } from 'react';
import CommandCenterLoginPage from './LoginClient.jsx';

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-neutral-950" />}>
      <CommandCenterLoginPage />
    </Suspense>
  );
}
