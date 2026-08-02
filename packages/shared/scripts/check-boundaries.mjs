#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = ['web', 'api', 'cc', 'ops-api', 'shared', 'db', 'workers'];
const packagesDir = join(root, 'packages');
const missing = required.filter((n) => !existsSync(join(packagesDir, n, 'package.json')));
if (missing.length) {
  console.error('MISSING_PACKAGES', missing.join(','));
  process.exit(1);
}
if (existsSync(join(packagesDir, 'dth-shared'))) {
  console.error('FORBIDDEN_ALIAS_PACKAGE packages/dth-shared must not exist');
  process.exit(1);
}
const names = [];
for (const n of required) {
  const pj = JSON.parse(readFileSync(join(packagesDir, n, 'package.json'), 'utf8'));
  names.push(pj.name);
  if (pj.dth?.skeletonOnly !== true) {
    console.error('NOT_SKELETON', n);
    process.exit(1);
  }
  const deps = {
    ...(pj.dependencies || {}),
    ...(pj.devDependencies || {}),
    ...(pj.peerDependencies || {}),
  };
  for (const dep of Object.keys(deps)) {
    if (/averion/i.test(dep)) {
      console.error('AVERION_DEPENDENCY_FOUND', n, dep);
      process.exit(1);
    }
  }
  const idxPath = join(packagesDir, n, 'src/index.js');
  if (existsSync(idxPath)) {
    const src = readFileSync(idxPath, 'utf8');
    if (/from\s+['"][^'"]*averion|require\(\s*['"][^'"]*averion/i.test(src)) {
      console.error('AVERION_IMPORT_FOUND', n);
      process.exit(1);
    }
  }
}
console.log('PACKAGE_BOUNDARY_CHECK_PASS', names.join(','));
