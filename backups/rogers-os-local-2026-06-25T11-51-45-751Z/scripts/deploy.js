#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

function run(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function commandExists(command) {
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  const paths = (process.env.PATH || '').split(path.delimiter);

  return paths.some((directory) => {
    return extensions.some((extension) => {
      return fs.existsSync(path.join(directory, command + extension));
    });
  });
}

function main() {
  run(process.execPath, ['scripts/validate.js']);
  run(process.execPath, ['scripts/backup.js']);

  if (!commandExists('clasp')) {
    console.error('clasp is not installed.');
    console.error('Install it with: npm install -g @google/clasp');
    console.error('Then run: clasp login');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(projectRoot, '.clasp.json'))) {
    console.error('.clasp.json not found. This folder is not linked to an Apps Script project.');
    console.error('Use: clasp clone <SCRIPT_ID>');
    console.error('Or create/link this folder after confirming the Rogers Holdings OS Apps Script project ID.');
    process.exit(1);
  }

  run('clasp', ['push']);
}

main();
