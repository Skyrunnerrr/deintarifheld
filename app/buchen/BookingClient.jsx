'use client';

import { useEffect, useState } from 'react';

export default function BookingClient() {
  const [state, setState] = useState({ loading: true, error: null, view: null, done: false });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('t') || params.get('token') || '';
    if (!token) {
      setState({ loading: false, error: 'INVALID_TOKEN', view: null, done: false });
      return;
    }
    fetch(`/api/booking?t=${encodeURIComponent(token)}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (r) => {
        const data = await r.json();
        if (!data.ok) throw new Error(data.code || 'ERROR');
        setState({ loading: false, error: null, view: { ...data, token }, done: data.status === 'BOOKED' });
      })
      .catch((e) => setState({ loading: false, error: e.message || 'ERROR', view: null, done: false }));
  }, []);

  async function selectSlot(slotId) {
    const token = state.view?.token;
    if (!token) return;
    setState((s) => ({ ...s, loading: true }));
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, slot_id: slotId }),
      cache: 'no-store',
    });
    const data = await res.json();
    if (!data.ok) {
      setState((s) => ({ ...s, loading: false, error: data.code || 'BOOKING_FAILED' }));
      return;
    }
    setState({ loading: false, error: null, view: state.view, done: true });
  }

  if (state.loading) return <p>Laden…</p>;
  if (state.error) return <p>Buchung nicht verfügbar ({state.error}).</p>;
  if (state.done) return <p>Termin angefragt bzw. bestätigt. Sie erhalten eine Bestätigung per E-Mail.</p>;

  return (
    <div>
      <p style={{ marginTop: '1.5rem' }}>
        <strong>Erstberatung</strong>
        {state.view?.bookingRef ? ` · ${state.view.bookingRef}` : ''}
      </p>
      <p style={{ color: '#555' }}>Zeitzone: {state.view?.timezone}</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {(state.view?.slots || []).map((s) => (
          <li key={s.slotId} style={{ margin: '0.75rem 0' }}>
            <button
              type="button"
              onClick={() => selectSlot(s.slotId)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.85rem 1rem',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {s.startLabel}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
