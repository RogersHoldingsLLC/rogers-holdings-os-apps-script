#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { TARGETS, readTargetConfig } = require('./deploy');

const projectRoot = path.resolve(__dirname, '..');

function commandExists(command) {
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  const paths = (process.env.PATH || '').split(path.delimiter);
  return paths.some((directory) => extensions.some((extension) => (
    fs.existsSync(path.join(directory, command + extension))
  )));
}

function main() {
  const targetName = process.argv[2];
  if (!targetName || !TARGETS[targetName]) {
    throw new Error('Status target is required. Use acceptance or production.');
  }
  const target = readTargetConfig(projectRoot, targetName);
  console.log(`Business Optimization Platform deployment status — ${target.label}`);
  console.log(`- target: ${targetName}`);
  console.log(`- configuration: ${target.configFile}`);
  console.log(`- Script ID: ${target.config.scriptId}`);
  console.log(`- clasp installed: ${commandExists('clasp') ? 'yes' : 'no'}`);
  console.log(`- authoritative Apps Script source: ${(target.config.scriptExtensions || []).join(', ') || 'not configured'}`);
  console.log(`- skip subdirectories: ${target.config.skipSubdirectories === true ? 'yes' : 'no'}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
