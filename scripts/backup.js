#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backupRoot = path.join(projectRoot, 'backups');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function copyIfExists(file, targetDir) {
  const source = path.join(projectRoot, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(targetDir, file));
  }
}

function copyDirectoryIfExists(directory, targetDir) {
  const sourceDir = path.join(projectRoot, directory);
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  const targetSubdir = path.join(targetDir, directory);
  fs.mkdirSync(targetSubdir, { recursive: true });
  fs.readdirSync(sourceDir)
    .filter((file) => fs.statSync(path.join(sourceDir, file)).isFile())
    .forEach((file) => {
      fs.copyFileSync(path.join(sourceDir, file), path.join(targetSubdir, file));
    });
}

function main() {
  const targetDir = path.join(backupRoot, `business-optimization-platform-local-${timestamp()}`);
  fs.mkdirSync(targetDir, { recursive: true });

  fs.readdirSync(projectRoot)
    .filter((file) => file.endsWith('.gs'))
    .sort()
    .forEach((file) => copyIfExists(file, targetDir));

  ['package.json', 'README.md', '.clasp.json', '.clasp.production.json', '.claspignore', 'appsscript.json'].forEach((file) => {
    copyIfExists(file, targetDir);
  });
  copyDirectoryIfExists('scripts', targetDir);

  console.log(`Backup created: ${targetDir}`);
}

main();
