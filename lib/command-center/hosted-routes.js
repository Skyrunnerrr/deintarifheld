/** Hosted Command Center route map — reuses CC view ids, prefixes /command-center */
export const HOSTED_CC_BASE = '/command-center';

export const HOSTED_CC_NAV = Object.freeze([
  { id: 'overview', href: `${HOSTED_CC_BASE}/`, label: 'Übersicht' },
  { id: 'inbox', href: `${HOSTED_CC_BASE}/inbox/`, label: 'Inbox' },
  { id: 'cases', href: `${HOSTED_CC_BASE}/vorgaenge/`, label: 'Vorgänge' },
  { id: 'approvals', href: `${HOSTED_CC_BASE}/freigaben/`, label: 'Freigaben' },
  { id: 'tasks', href: `${HOSTED_CC_BASE}/aufgaben/`, label: 'Aufgaben' },
  { id: 'workflows', href: `${HOSTED_CC_BASE}/workflows/`, label: 'Workflows' },
  { id: 'lifecycle', href: `${HOSTED_CC_BASE}/kunden/`, label: 'Kunden' },
  { id: 'controls', href: `${HOSTED_CC_BASE}/steuerung/`, label: 'Steuerung' },
  { id: 'audit', href: `${HOSTED_CC_BASE}/audit/`, label: 'Audit' },
]);

const VIEW_ALIASES = Object.freeze({
  '': 'overview',
  overview: 'overview',
  inbox: 'inbox',
  vorgaenge: 'cases',
  cases: 'cases',
  freigaben: 'approvals',
  approvals: 'approvals',
  aufgaben: 'tasks',
  tasks: 'tasks',
  workflows: 'workflows',
  kunden: 'lifecycle',
  lifecycle: 'lifecycle',
  steuerung: 'controls',
  controls: 'controls',
  audit: 'audit',
});

export function resolveHostedCcView(segments = []) {
  const first = String(segments[0] || '').replace(/\/$/, '');
  return VIEW_ALIASES[first] ?? null;
}

export function isHostedCcPublicPath(pathname) {
  const p = pathname.replace(/\/$/, '') || '/';
  return (
    p === `${HOSTED_CC_BASE}/login` ||
    p === `${HOSTED_CC_BASE}/mfa` ||
    p === `${HOSTED_CC_BASE}/set-password` ||
    p.startsWith('/auth/callback')
  );
}
