/** @deintarifheld/db — draft metadata + P3-F5 local outbox claim adapter */
export const DTH_PACKAGE_SKELETON = Object.freeze({
  name: '@deintarifheld/db',
  tranche: 'P3-F5',
  skeletonOnly: true,
  draftMigrationsOnly: true,
  migrationApplicationAuthorized: false,
});

export {
  P3_F2A_DRAFT_ROOT,
  P3_F2A_DRAFT_FILES,
  P3_F2A_FIRST_SLICE_TABLES,
  P3_F2A_SOFT_DELETE_TABLES,
  P3_F2A_FORBIDDEN_TABLE_SUBSTRINGS,
  P3_F2A_PROTECTED_SPINE_TABLES,
  P3_F2A_CLAIMS,
} from './draft-catalog.js';

export {
  createLocalOutboxPool,
  claimOneSyntheticNoop,
  markOutboxProcessed,
  markOutboxFailed,
} from './outbox-claim.js';
