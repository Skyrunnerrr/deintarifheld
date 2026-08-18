'use client';

import { useEffect, useState } from 'react';

export default function OfferClient() {
  const [state, setState] = useState({ loading: true, view: null, error: null, done: null });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t') || '';
    if (!token) {
      setState({ loading: false, view: null, error: 'INVALID_TOKEN', done: null });
      return;
    }
    fetch(`/api/offer?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((view) => {
        if (!view.ok) setState({ loading: false, view: null, error: view.code, done: null });
        else setState({ loading: false, view, error: null, done: null });
      })
      .catch(() => setState({ loading: false, view: null, error: 'UNAVAILABLE', done: null }));
  }, []);

  async function act(action, optionId) {
    const token = new URLSearchParams(window.location.search).get('t') || '';
    const res = await fetch('/api/offer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, action, option_id: optionId }),
    });
    const json = await res.json();
    if (!json.ok) setState((s) => ({ ...s, error: json.code }));
    else setState((s) => ({ ...s, done: json.decision, error: null }));
  }

  if (state.loading) return <p>Laden…</p>;
  if (state.error) return <p>Dieses Angebot ist nicht verfügbar ({state.error}).</p>;
  if (state.done) return <p>Ihre Entscheidung wurde registriert: {state.done}.</p>;
  const view = state.view;
  return (
    <div>
      <p><strong>{view.banner}</strong></p>
      {(view.options || []).map((opt) => (
        <section key={opt.optionId} style={{ margin: '1.5rem 0' }}>
          <h2 style={{ fontSize: '1.1rem' }}>{opt.supplierName} — {opt.tariffName}</h2>
          <p>Energieart: {opt.energyType} ({opt.priceBasisLabel})</p>
          {opt.ongoingAnnualFormatted ? <p>Jahreskosten laufend: {opt.ongoingAnnualFormatted}</p> : null}
          {opt.firstYearDiffers ? <p>Jahreskosten erstes Jahr: {opt.firstYearAnnualFormatted}</p> : null}
          {opt.additionalCostOngoingFormatted ? (
            <p>Zusätzliche Kosten (laufend): {opt.additionalCostOngoingFormatted}</p>
          ) : null}
          {opt.comparisonOngoingFormatted && !opt.savingsUnknown ? (
            <p>Differenz zu bisher (laufend): {opt.comparisonOngoingFormatted}</p>
          ) : null}
          {opt.savingsUnknown ? <p>kein belastbarer Kostenvergleich</p> : null}
          <button type="button" onClick={() => act('accept', opt.optionId)}>Angebot annehmen</button>
        </section>
      ))}
      <button type="button" onClick={() => act('reject')}>Ablehnen</button>
      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#555' }}>{view.legalText}</p>
    </div>
  );
}
