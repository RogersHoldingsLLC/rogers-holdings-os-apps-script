#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { compareProductionSourceInventories, deploy, readTargetConfig } = require('./deploy');

const acceptance = JSON.stringify({ scriptId: 'acceptance-id' }, null, 2) + '\n';
const production = JSON.stringify({ scriptId: 'production-id' }, null, 2) + '\n';
let passed = 0;

function test(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    passed += 1;
    console.log(`PASS ${name}`);
  });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-test-'));
  fs.writeFileSync(path.join(root, '.clasp.json'), acceptance);
  fs.writeFileSync(path.join(root, '.clasp.production.json'), production);
  return root;
}

function validatorFixture() {
  const root = fixture();
  const sourceRoot = path.resolve(__dirname, '..');
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.join(__dirname, 'validate.js'), path.join(root, 'scripts', 'validate.js'));
  fs.readdirSync(sourceRoot).filter((file) => file.endsWith('.gs')).forEach((file) => {
    fs.copyFileSync(path.join(sourceRoot, file), path.join(root, file));
  });
  fs.copyFileSync(path.join(sourceRoot, '.claspignore'), path.join(root, '.claspignore'));
  fs.writeFileSync(path.join(root, '.clasp.json'), JSON.stringify({
    scriptId: 'acceptance-id', scriptExtensions: ['.gs'], skipSubdirectories: true
  }));
  return root;
}

function runValidator(root, manifestText) {
  // Only the isolated fixture changes. Run the actual CLI, including all security checks.
  fs.writeFileSync(path.join(root, 'appsscript.json'), manifestText);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'validate.js')], {
    cwd: root, encoding: 'utf8'
  });
  assert.ifError(result.error);
  assert.strictEqual(result.signal, null);
  return { status: result.status, output: result.stdout + result.stderr };
}

function options(root, overrides = {}) {
  return {
    projectRoot: root,
    commandExists: () => true,
    confirm: async () => 'DEPLOY PRODUCTION',
    capture: (command, args) => args[0] === 'status' ? '' : 'main',
    run: () => {},
    verifyProductionSourceInventory: () => {},
    ...overrides
  };
}

async function rejects(fn, pattern) {
  await assert.rejects(fn, pattern);
}

async function main() {
  await test('missing target rejected', async () => {
    const root = fixture();
    assert.throws(() => readTargetConfig(root), /Invalid deployment target/);
  });
  await test('invalid target rejected', async () => {
    const root = fixture();
    assert.throws(() => readTargetConfig(root, 'other'), /Invalid deployment target/);
  });
  await test('acceptance target selects .clasp.json', async () => {
    const target = readTargetConfig(fixture(), 'acceptance');
    assert.strictEqual(target.configFile, '.clasp.json');
    assert.strictEqual(target.config.scriptId, 'acceptance-id');
  });
  await test('production target selects .clasp.production.json', async () => {
    const target = readTargetConfig(fixture(), 'production');
    assert.strictEqual(target.configFile, '.clasp.production.json');
    assert.strictEqual(target.config.scriptId, 'production-id');
  });
  await test('production rejects dirty worktree', async () => {
    const root = fixture();
    await rejects(() => deploy('production', options(root, {
      capture: (command, args) => args[0] === 'status' ? ' M file.gs' : 'main'
    })), /working tree is not clean/);
  });
  await test('production rejects incorrect confirmation', async () => {
    const root = fixture();
    await rejects(() => deploy('production', options(root, {
      confirm: async () => 'deploy production'
    })), /confirmation did not exactly match/);
  });
  await test('production source inventory rejects unexpected remote-only files', async () => {
    assert.deepStrictEqual(
      compareProductionSourceInventories(['AuditEngine.gs'], ['AuditEngine.js', 'HeadquartersSalesFeed.js']),
      ['HeadquartersSalesFeed.gs']
    );
  });
  await test('production source inventory allows reconciled remote files and candidate additions', async () => {
    assert.deepStrictEqual(
      compareProductionSourceInventories(
        ['AuditEngine.gs', 'HeadquartersSalesFeed.gs', 'GoldStandardDeliverables.gs'],
        ['AuditEngine.js', 'HeadquartersSalesFeed.js']
      ),
      []
    );
  });
  await test('production runs the complete release validation gate', async () => {
    const root = fixture();
    const commands = [];
    await deploy('production', options(root, {
      run: (command, args) => {
        commands.push([command].concat(args).join(' '));
      }
    }));
    assert.deepStrictEqual(commands.slice(0, 11), [
      'npm run validate',
      'npm run test:gold-standard-authoritative',
      'npm run test:production-source-reconciliation',
      'npm run test:follow-up-execution',
      'npm run test:business-snapshot-naming',
      'npm run test:prospect-revenue',
      'npm run test:lifecycle',
      'npm run test:audit-rendering',
      'npm run test:ebi',
      'npm test',
      'git diff --check'
    ]);
  });
  await test('production restores .clasp.json after success', async () => {
    const root = fixture();
    let pushedConfig = '';
    await deploy('production', options(root, {
      run: (command) => {
        if (command === 'clasp') pushedConfig = fs.readFileSync(path.join(root, '.clasp.json'), 'utf8');
      }
    }));
    assert.strictEqual(pushedConfig, production);
    assert.strictEqual(fs.readFileSync(path.join(root, '.clasp.json'), 'utf8'), acceptance);
  });
  await test('production restores .clasp.json after failure', async () => {
    const root = fixture();
    await rejects(() => deploy('production', options(root, {
      run: (command) => {
        if (command === 'clasp') throw new Error('push failed');
      }
    })), /push failed/);
    assert.strictEqual(fs.readFileSync(path.join(root, '.clasp.json'), 'utf8'), acceptance);
  });
  await test('no deploy command defaults to production', async () => {
    const root = fixture();
    assert.throws(() => readTargetConfig(root, ''), /Invalid deployment target/);
  });

  const validatorRoot = validatorFixture();
  const baseManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'appsscript.json'), 'utf8'));
  delete baseManifest.webapp;
  const approvedWebapp = { access: 'ANYONE_ANONYMOUS', executeAs: 'USER_DEPLOYING' };
  const approvedManifest = { ...baseManifest, webapp: approvedWebapp };
  for (const [name, manifest] of [
    ['absent webapp', baseManifest],
    ['approved webapp', approvedManifest],
    ['reversed webapp key order', {
      ...baseManifest, webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' }
    }]
  ]) {
    await test(`validator accepts ${name}`, () => {
      const result = runValidator(validatorRoot, JSON.stringify(manifest, null, 2));
      assert.strictEqual(result.status, 0, result.output);
      assert.match(result.output, /Validation passed for \d+ Apps Script files/);
    });
  }
  for (const [name, webapp] of [
    ['null', null], ['false', false], ['true', true], ['number', 0],
    ['empty string', ''], ['string', 'approved'], ['array', []],
    ['empty object', {}],
    ['missing access', { executeAs: 'USER_DEPLOYING' }],
    ['missing executeAs', { access: 'ANYONE_ANONYMOUS' }],
    ['extra key', { ...approvedWebapp, extra: true }],
    ['non-string access', { ...approvedWebapp, access: true }],
    ['non-string executeAs', { ...approvedWebapp, executeAs: 1 }],
    ['null access', { ...approvedWebapp, access: null }],
    ['array executeAs', { ...approvedWebapp, executeAs: ['USER_DEPLOYING'] }],
    ['empty access', { ...approvedWebapp, access: '' }],
    ['empty executeAs', { ...approvedWebapp, executeAs: '' }],
    ['access capitalization', { ...approvedWebapp, access: 'anyone_anonymous' }],
    ['executeAs capitalization', { ...approvedWebapp, executeAs: 'user_deploying' }],
    ['access whitespace', { ...approvedWebapp, access: ' ANYONE_ANONYMOUS ' }],
    ['executeAs whitespace', { ...approvedWebapp, executeAs: ' USER_DEPLOYING ' }],
    ['different access', { ...approvedWebapp, access: 'ANYONE' }],
    ['different executeAs', { ...approvedWebapp, executeAs: 'USER_ACCESSING' }]
  ]) {
    await test(`validator rejects webapp ${name}`, () => {
      const result = runValidator(validatorRoot, JSON.stringify({ ...baseManifest, webapp }));
      assert.strictEqual(result.status, 1, result.output);
      assert.match(result.output, /appsscript\.json \/webapp must contain exactly/);
    });
  }
  for (const [name, manifest] of [['absent', baseManifest], ['approved', approvedManifest]]) {
    await test(`validator rejects anonymous access elsewhere with ${name} root webapp`, () => {
      const result = runValidator(validatorRoot, JSON.stringify({
        ...manifest, nested: { webapp: approvedWebapp }
      }));
      assert.strictEqual(result.status, 1, result.output);
      assert.match(result.output, /anonymous web-app access outside the approved root \/webapp/);
    });
  }
  await test('validator still rejects malformed manifest JSON', () => {
    const result = runValidator(validatorRoot, '{');
    assert.strictEqual(result.status, 1, result.output);
    assert.match(result.output, /appsscript\.json is not valid JSON/);
  });
  await test('approved webapp does not bypass later reset security checks', () => {
    const menuPath = path.join(validatorRoot, 'Menu.gs');
    const originalMenu = fs.readFileSync(menuPath, 'utf8');
    const resetItem = ".addItem('Reset Test Data', 'resetTestData')";
    assert(originalMenu.includes(resetItem), 'reset fixture must change an existing menu action');
    fs.writeFileSync(menuPath, originalMenu.replace(resetItem, ''));
    const result = runValidator(validatorRoot, JSON.stringify(approvedManifest));
    assert.strictEqual(result.status, 1, result.output);
    assert.match(result.output, /Reset menu actions must be added only through read-only developer-mode logic/);
    assert.doesNotMatch(result.output, /appsscript\.json/);
  });
  console.log(`\n${passed} deployment safety tests passed.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
