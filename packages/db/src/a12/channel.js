/**
 * Channel rendering — formatting only, no claim rewrite.
 */
import { ContentChannel } from '@deintarifheld/shared';
import { escapePlaintext } from './brand.js';

const LIMITS = Object.freeze({
  [ContentChannel.SYNTHETIC_LINKEDIN]: { maxBody: 1200, maxHashtags: 3 },
  [ContentChannel.SYNTHETIC_BLOG]: { maxBody: 4000, maxHashtags: 5 },
});

export function renderForChannel({ headline, bodyText, cta, hashtags = [], links = [] }, channel) {
  const lim = LIMITS[channel] || LIMITS[ContentChannel.SYNTHETIC_LINKEDIN];
  const safeHeadline = escapePlaintext(headline).slice(0, 200);
  const safeBody = escapePlaintext(bodyText).slice(0, lim.maxBody);
  const safeCta = escapePlaintext(cta).slice(0, 120);
  const tags = (hashtags || []).slice(0, lim.maxHashtags).map((t) => escapePlaintext(t));
  const payload = {
    channel,
    headline: safeHeadline,
    bodyText: safeBody,
    cta: safeCta,
    hashtags: tags,
    links: links || [],
    plaintext: `${safeHeadline}\n\n${safeBody}\n\n${safeCta}${tags.length ? `\n${tags.join(' ')}` : ''}`,
  };
  return { ok: true, channelPayload: payload, limits: lim };
}

export function channelFactsEquivalent(a, b) {
  const norm = (x) => String(x || '').replace(/\s+/g, ' ').trim().toLowerCase();
  // Compare core factual body without channel-specific truncation markers
  return norm(a?.bodyText).slice(0, 200) === norm(b?.bodyText).slice(0, 200)
    && norm(a?.headline).slice(0, 80) === norm(b?.headline).slice(0, 80);
}
