const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function iterator(items) {
  let index = 0;
  return {
    hasNext: () => index < items.length,
    next: () => items[index++]
  };
}

function loadDriveEngine(options = {}) {
  const globalFolders = options.globalFolders || [];
  const rootChildren = options.rootChildren || [];
  const created = [];
  const configuredRoot = {
    getFoldersByName: () => iterator(rootChildren),
    createFolder: (name) => {
      const folder = { name, parent: 'configured-root' };
      created.push(folder);
      return folder;
    }
  };
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) => {
          assert.equal(name, 'BOP_CLIENT_DRIVE_ROOT_ID');
          return options.rootId || '';
        }
      })
    },
    DriveApp: {
      getFolderById: (id) => {
        if (options.rootError) throw new Error('unavailable');
        assert.equal(id, options.rootId);
        return configuredRoot;
      },
      getFoldersByName: () => iterator(globalFolders),
      createFolder: (name) => ({ name, parent: 'drive-root' })
    },
    sanitizeDriveFileName_: (value) => String(value || '').trim(),
    console
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'DriveEngine.gs'), 'utf8'), context);
  return { context, configuredRoot, created };
}

test('configured client root scopes folder creation and ignores global matches', () => {
  const global = { name: 'Synthetic Co', parent: 'drive-root' };
  const { context, created } = loadDriveEngine({ rootId: 'clients-root', globalFolders: [global] });
  const folder = context.getOrCreateAuditPackageFolder_('Synthetic Co');
  assert.equal(folder.parent, 'configured-root');
  assert.equal(created.length, 1);
});

test('configured client root reuses one exact child', () => {
  const child = { name: 'Synthetic Co', parent: 'configured-root' };
  const { context, created } = loadDriveEngine({ rootId: 'clients-root', rootChildren: [child] });
  assert.equal(context.getOrCreateAuditPackageFolder_('Synthetic Co'), child);
  assert.equal(context.getExistingClientArtifactFolder_('Synthetic Co'), child);
  assert.equal(created.length, 0);
});

test('configured client root fails closed on duplicate exact children', () => {
  const duplicate = { name: 'Synthetic Co' };
  const { context } = loadDriveEngine({ rootId: 'clients-root', rootChildren: [duplicate, duplicate] });
  assert.throws(
    () => context.getOrCreateAuditPackageFolder_('Synthetic Co'),
    /Multiple client folders/
  );
});

test('configured client root fails closed when unavailable', () => {
  const { context } = loadDriveEngine({ rootId: 'clients-root', rootError: true });
  assert.throws(
    () => context.getOrCreateAuditPackageFolder_('Synthetic Co'),
    /configured production client Drive root is unavailable/
  );
});

test('missing configuration preserves legacy global lookup behavior', () => {
  const global = { name: 'Legacy Co', parent: 'drive-root' };
  const { context } = loadDriveEngine({ globalFolders: [global] });
  assert.equal(context.getOrCreateAuditPackageFolder_('Legacy Co'), global);
  assert.equal(context.getExistingClientArtifactFolder_('Legacy Co'), global);
});
