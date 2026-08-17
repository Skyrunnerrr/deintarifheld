/**
 * Minimal public booking shell — noindex, no Case IDs.
 */
import BookingClient from './BookingClient.jsx';

export const metadata = {
  title: 'Termin wählen — DeinTarifheld',
  robots: { index: false, follow: false },
};

export default function BookingPage() {
  return (
    <main style={{ fontFamily: 'Georgia, serif', maxWidth: 560, margin: '3rem auto', padding: '0 1.25rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>DeinTarifheld</h1>
      <p style={{ color: '#333', lineHeight: 1.5 }}>
        Wählen Sie einen Termin für Ihre Online-Erstberatung.
      </p>
      <BookingClient />
    </main>
  );
}
