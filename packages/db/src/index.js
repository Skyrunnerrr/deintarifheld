/** @deintarifheld/db — P3-F0 boundary + P3-F2a draft metadata (no apply). */
export const DTH_PACKAGE_SKELETON = Object.freeze({
  name: '@deintarifheld/db',
  tranche: 'P3-F2A',
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
