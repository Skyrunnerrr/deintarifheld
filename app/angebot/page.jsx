/**
 * Minimal public offer shell — noindex, no Case IDs.
 */
import OfferClient from './OfferClient.jsx';

export const metadata = {
  title: 'Angebot — DeinTarifheld',
  robots: { index: false, follow: false },
};

export default function OfferPage() {
  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 560, margin: '3rem auto', padding: '0 1.25rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>DeinTarifheld</h1>
      <p style={{ color: '#333', lineHeight: 1.5 }}>
        TEST_ONLY / SYNTHETISCH / nicht kundenlivetauglich
      </p>
      <OfferClient />
    </main>
  );
}
