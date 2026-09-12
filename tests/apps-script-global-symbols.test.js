const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

function topLevelFunctionDeclarations() {
  const declarations = new Map();
  fs.readdirSync(ROOT).filter(file => file.endsWith('.gs')).sort().forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of source.matchAll(/(?:^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
      const locations = declarations.get(match[1]) || [];
      locations.push(file + ':' + source.slice(0, match.index).split('\n').length);
      declarations.set(match[1], locations);
    }
  });
  return declarations;
}

function topLevelVarDeclarations() {
  const declarations = new Map();
  fs.readdirSync(ROOT).filter(file => file.endsWith('.gs')).sort().forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const match of source.matchAll(/(?:^|\n)\s*var\s+([A-Za-z_$][\w$]*)/g)) {
      const locations = declarations.get(match[1]) || []; locations.push(file); declarations.set(match[1], locations);
    }
  });
  return declarations;
}

test('the complete deployed Apps Script inventory has no duplicate global function declarations', () => {
  const duplicates = [...topLevelFunctionDeclarations()].filter(([, locations]) => locations.length > 1);
  assert.deepEqual(duplicates, []);
});

test('the complete deployed Apps Script inventory has no duplicate top-level var declarations', () => {
  assert.deepEqual([...topLevelVarDeclarations()].filter(([, locations]) => locations.length > 1), []);
});

test('the live menu identity path has one canonical implementation', () => {
  const declarations = topLevelFunctionDeclarations();
  ['markSelectedRecommendationReviewed', 'markFindingQualityRecommendationReviewed_', 'markFindingQualityRecommendationReviewedLocked_', 'assertRecommendationSeedIdentity_', 'assertPreSnapshotSuccessorRecommendationIdentity_', 'assertPreservedPreSnapshotApprovedIdentity_', 'buildFindingApprovalOperationKey_'].forEach(name => {
    assert.equal((declarations.get(name) || []).length, 1, name);
  });
});
