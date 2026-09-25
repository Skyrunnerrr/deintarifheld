export const MAX_LEAD_BODY_BYTES = 12_288

/**
 * Read a request body with a hard byte cap while consuming the stream.
 * Content-Length is an early-reject hint only — missing/forged values are not trusted.
 */
export async function readBodyText(request, { maxBytes = MAX_LEAD_BODY_BYTES } = {}) {
  const declared = request.headers.get('content-length')
  if (declared != null && declared !== '') {
    const n = Number(declared)
    if (Number.isFinite(n) && n > maxBytes) {
      return { ok: false, code: 'payload-too-large', status: 413 }
    }
  }

  const stream = request.body
  if (!stream || typeof stream.getReader !== 'function') {
    return { ok: false, code: 'invalid-payload', status: 400 }
  }

  const reader = stream.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          /* ignore */
        }
        return { ok: false, code: 'payload-too-large', status: 413 }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, code: 'invalid-payload', status: 400 }
  }

  const buf = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  if (!buf.length) {
    return { ok: false, code: 'invalid-payload', status: 400 }
  }

  return { ok: true, text: buf.toString('utf8'), bytes: buf.length }
}

/**
 * Read JSON using the same bounded body reader.
 */
export async function readJsonBody(request, { maxBytes = MAX_LEAD_BODY_BYTES } = {}) {
  const body = await readBodyText(request, { maxBytes })
  if (!body.ok) return body

  try {
    return { ok: true, data: JSON.parse(body.text), bytes: body.bytes }
  } catch {
    return { ok: false, code: 'invalid-payload', status: 400 }
  }
}
