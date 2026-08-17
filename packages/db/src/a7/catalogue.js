/**
 * A7 synthetic tariff catalogue import + active snapshot selection.
 */
import { createHash } from 'node:crypto';
import { buildSyntheticCatalogueDefinitions } from './fixtures.js';

function snapshotHash(versionIds) {
  const sorted = [...versionIds].map(String).sort();
  return createHash('sha256').update(sorted.join('|')).digest('hex');
}

/**
 * Import synthetic TEST_FIXTURE catalogue (idempotent by source_ref / product+version).
 * Returns catalogue snapshot id containing currently effective ACTIVE versions at `at`.
 */
export async function importSyntheticCatalogue(pool, { at = new Date(), notes = 'synthetic E2 catalogue' } = {}) {
  const defs = buildSyntheticCatalogueDefinitions(at);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const supplierIds = new Map();
    for (const s of defs.suppliers) {
      const { rows } = await client.query(
        `INSERT INTO ops.tariff_suppliers (code, name, status)
         VALUES ($1,$2,'ACTIVE')
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code`,
        [s.code, s.name],
      );
      supplierIds.set(s.code, rows[0].id);
    }

    const versionIds = [];
    for (const p of defs.products) {
      const supplierId = supplierIds.get(p.supplierCode);
      const { rows: prows } = await client.query(
        `INSERT INTO ops.tariff_products (supplier_id, product_code, energy_type, customer_segment, status)
         VALUES ($1,$2,$3,$4,'ACTIVE')
         ON CONFLICT (supplier_id, product_code) DO UPDATE
           SET energy_type = EXCLUDED.energy_type,
               customer_segment = EXCLUDED.customer_segment
         RETURNING id`,
        [supplierId, p.productCode, p.energyType, p.customerSegment],
      );
      const productId = prows[0].id;
      for (const v of p.versions) {
        const { rows: vrows } = await client.query(
          `INSERT INTO ops.tariff_versions
            (product_id, version, valid_from, valid_to, status, currency, price_basis,
             source_kind, source_ref, source_hash, imported_at)
           VALUES ($1,$2,$3::timestamptz,$4::timestamptz,$5,$6,$7,$8,$9,$10,now())
           ON CONFLICT (product_id, version) DO UPDATE
             SET valid_from = EXCLUDED.valid_from,
                 valid_to = EXCLUDED.valid_to,
                 status = EXCLUDED.status,
                 currency = EXCLUDED.currency,
                 price_basis = EXCLUDED.price_basis,
                 source_kind = EXCLUDED.source_kind,
                 source_ref = EXCLUDED.source_ref,
                 source_hash = EXCLUDED.source_hash
           RETURNING id`,
          [
            productId,
            v.version,
            v.validFrom,
            v.validTo,
            v.status,
            v.currency,
            v.priceBasis,
            v.sourceKind,
            v.sourceRef,
            v.sourceHash,
          ],
        );
        const versionId = vrows[0].id;
        versionIds.push(versionId);
        await client.query(`DELETE FROM ops.tariff_price_components WHERE tariff_version_id = $1`, [versionId]);
        await client.query(`DELETE FROM ops.tariff_eligibility_rules WHERE tariff_version_id = $1`, [versionId]);
        for (const c of v.components) {
          await client.query(
            `INSERT INTO ops.tariff_price_components
              (tariff_version_id, component_type, unit, rate_micro, frequency, per_supply_point, applies_to, sort_order)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              versionId,
              c.componentType,
              c.unit,
              String(c.rateMicro),
              c.frequency,
              c.perSupplyPoint,
              c.appliesTo,
              c.sortOrder,
            ],
          );
        }
        for (const r of v.rules) {
          await client.query(
            `INSERT INTO ops.tariff_eligibility_rules (tariff_version_id, rule_type, params)
             VALUES ($1,$2,$3::jsonb)`,
            [versionId, r.ruleType, JSON.stringify(r.params)],
          );
        }
      }
    }

    const active = await loadActiveTariffVersionIds(client, at);
    const hash = snapshotHash(active);
    let snapshotId;
    const existing = await client.query(
      `SELECT id FROM ops.tariff_catalogue_snapshots WHERE snapshot_hash = $1`,
      [hash],
    );
    if (existing.rows[0]) {
      snapshotId = existing.rows[0].id;
    } else {
      const { rows } = await client.query(
        `INSERT INTO ops.tariff_catalogue_snapshots (snapshot_hash, notes)
         VALUES ($1,$2) RETURNING id`,
        [hash, notes],
      );
      snapshotId = rows[0].id;
      for (const vid of active) {
        await client.query(
          `INSERT INTO ops.tariff_catalogue_snapshot_members (snapshot_id, tariff_version_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [snapshotId, vid],
        );
      }
    }

    await client.query('COMMIT');
    return { ok: true, snapshotId, versionCount: versionIds.length, activeCount: active.length, snapshotHash: hash };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function loadActiveTariffVersionIds(client, at) {
  const { rows } = await client.query(
    `SELECT id FROM ops.tariff_versions
     WHERE status = 'ACTIVE'
       AND valid_from <= $1::timestamptz
       AND (valid_to IS NULL OR valid_to > $1::timestamptz)
     ORDER BY id`,
    [at.toISOString()],
  );
  return rows.map((r) => r.id);
}

/**
 * Get or create active catalogue snapshot at time `at`.
 * Excludes expired / future / inactive versions from membership.
 */
export async function getActiveCatalogueSnapshot(pool, at = new Date()) {
  const client = await pool.connect();
  try {
    const active = await loadActiveTariffVersionIds(client, at);
    if (!active.length) {
      return { ok: true, empty: true, snapshotId: null, versionIds: [], snapshotHash: null };
    }
    const hash = snapshotHash(active);
    const existing = await client.query(
      `SELECT id FROM ops.tariff_catalogue_snapshots WHERE snapshot_hash = $1`,
      [hash],
    );
    if (existing.rows[0]) {
      return {
        ok: true,
        empty: false,
        snapshotId: existing.rows[0].id,
        versionIds: active,
        snapshotHash: hash,
      };
    }
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO ops.tariff_catalogue_snapshots (snapshot_hash, notes)
       VALUES ($1,$2) RETURNING id`,
      [hash, `auto snapshot @ ${at.toISOString()}`],
    );
    const snapshotId = rows[0].id;
    for (const vid of active) {
      await client.query(
        `INSERT INTO ops.tariff_catalogue_snapshot_members (snapshot_id, tariff_version_id)
         VALUES ($1,$2)`,
        [snapshotId, vid],
      );
    }
    await client.query('COMMIT');
    return { ok: true, empty: false, snapshotId, versionIds: active, snapshotHash: hash };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Load tariff versions (+ components + rules + product) for a snapshot.
 */
export async function loadSnapshotTariffs(pool, snapshotId) {
  if (!snapshotId) return [];
  const { rows: versions } = await pool.query(
    `SELECT v.*, p.product_code, p.energy_type, p.customer_segment, p.supplier_id, s.code AS supplier_code, s.name AS supplier_name
     FROM ops.tariff_catalogue_snapshot_members m
     JOIN ops.tariff_versions v ON v.id = m.tariff_version_id
     JOIN ops.tariff_products p ON p.id = v.product_id
     JOIN ops.tariff_suppliers s ON s.id = p.supplier_id
     WHERE m.snapshot_id = $1
     ORDER BY v.id`,
    [snapshotId],
  );
  const out = [];
  for (const v of versions) {
    const { rows: components } = await pool.query(
      `SELECT * FROM ops.tariff_price_components WHERE tariff_version_id = $1 ORDER BY sort_order, id`,
      [v.id],
    );
    const { rows: rules } = await pool.query(
      `SELECT * FROM ops.tariff_eligibility_rules WHERE tariff_version_id = $1 ORDER BY id`,
      [v.id],
    );
    out.push({
      tariffVersionId: v.id,
      productId: v.product_id,
      productCode: v.product_code,
      version: v.version,
      energyType: v.energy_type,
      customerSegment: v.customer_segment,
      status: v.status,
      validFrom: v.valid_from,
      validTo: v.valid_to,
      currency: v.currency,
      priceBasis: v.price_basis,
      sourceKind: v.source_kind,
      sourceRef: v.source_ref,
      sourceHash: v.source_hash,
      supplierId: v.supplier_id,
      supplierCode: v.supplier_code,
      supplierName: v.supplier_name,
      components: components.map((c) => ({
        id: c.id,
        componentType: c.component_type,
        unit: c.unit,
        rateMicro: BigInt(c.rate_micro),
        frequency: c.frequency,
        perSupplyPoint: c.per_supply_point,
        appliesTo: c.applies_to,
        sortOrder: c.sort_order,
      })),
      rules: rules.map((r) => ({
        id: r.id,
        ruleType: r.rule_type,
        params: r.params,
      })),
    });
  }
  return out;
}

/** Clear catalogue tables (tests). */
export async function clearTariffCatalogue(pool) {
  await pool.query(`DELETE FROM ops.tariff_catalogue_snapshot_members`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_catalogue_snapshots`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_evaluation_results`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_evaluations`).catch(() => {});
  await pool.query(`DELETE FROM ops.energy_profiles`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_eligibility_rules`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_price_components`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_versions`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_products`).catch(() => {});
  await pool.query(`DELETE FROM ops.tariff_suppliers`).catch(() => {});
}
