#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { deploy, readTargetConfig } = require('./deploy');

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

function options(root, overrides = {}) {
  return {
    projectRoot: root,
    commandExists: () => true,
    confirm: async () => 'DEPLOY PRODUCTION',
    capture: (command, args) => args[0] === 'status' ? '' : 'main',
    run: () => {},
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
  await test('production runs the complete release validation gate', async () => {
    const root = fixture();
    const commands = [];
    await deploy('production', options(root, {
      run: (command, args) => {
        commands.push([command].concat(args).join(' '));
      }
    }));
    assert.deepStrictEqual(commands.slice(0, 9), [
      'npm run validate',
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
  console.log(`\n${passed} deployment safety tests passed.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
