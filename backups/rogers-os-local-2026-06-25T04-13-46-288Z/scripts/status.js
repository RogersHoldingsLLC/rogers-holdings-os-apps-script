#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

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
  const claspInstalled = commandExists('clasp');
  const claspConfigPath = path.join(projectRoot, '.clasp.json');
  const claspConfigExists = fs.existsSync(claspConfigPath);
  let scriptId = '';

  if (claspConfigExists) {
    try {
      const config = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));
      scriptId = config.scriptId || '';
    } catch (error) {
      scriptId = 'Unreadable .clasp.json';
    }
  }

  console.log('Rogers Holdings OS deployment status');
  console.log(`- clasp installed: ${claspInstalled ? 'yes' : 'no'}`);
  console.log(`- .clasp.json present: ${claspConfigExists ? 'yes' : 'no'}`);
  console.log(`- Apps Script project ID: ${scriptId || 'not configured locally'}`);
  if (claspConfigExists) {
    try {
      const config = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));
      console.log(`- authoritative Apps Script source: ${(config.scriptExtensions || []).join(', ') || 'not configured'}`);
      console.log(`- skip subdirectories: ${config.skipSubdirectories === true ? 'yes' : 'no'}`);
    } catch (error) {
      console.log('- deployment config could not be inspected');
    }
  }

  if (!claspInstalled) {
    console.log('\nInstall clasp with: npm install -g @google/clasp');
  }
  if (!claspConfigExists) {
    console.log('Link this folder with: clasp clone <SCRIPT_ID>');
    console.log('Or create .clasp.json with the target scriptId after confirming the live project.');
  }
}

main();
