#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const requiredFiles = [
  'Code.gs',
  'Config.gs',
  'Menu.gs',
  'SheetHelpers.gs',
  'AuditEngine.gs',
  'PdfEngine.gs',
  'GmailEngine.gs',
  'CalendarEngine.gs',
  'DriveEngine.gs',
  'DemoData.gs',
  'HealthCheck.gs'
];

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
}

function getGsFiles() {
  return fs.readdirSync(projectRoot)
    .filter((file) => file.endsWith('.gs'))
    .sort();
}

function getRootDuplicatePairs() {
  return getGsFiles()
    .map((file) => {
      return {
        gs: file,
        js: file.replace(/\.gs$/, '.js')
      };
    })
    .filter((pair) => fs.existsSync(path.join(projectRoot, pair.js)));
}

function assertRequiredFiles() {
  requiredFiles.forEach((file) => {
    if (!fs.existsSync(path.join(projectRoot, file))) {
      fail(`Required file missing: ${file}`);
    }
  });
}

function assertSyntax(files) {
  files.forEach((file) => {
    const fullPath = path.join(projectRoot, file);
    const source = fs.readFileSync(fullPath, 'utf8');
    try {
      new vm.Script(source, { filename: file });
    } catch (error) {
      fail(`Syntax error in ${file}: ${error.message}`);
    }
  });
}

function assertDuplicateFunctions(files) {
  const seen = new Map();
  const duplicates = [];
  const functionPattern = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;

  files.forEach((file) => {
    const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    let match;
    while ((match = functionPattern.exec(source)) !== null) {
      const name = match[1];
      if (seen.has(name)) {
        duplicates.push(`${name}: ${seen.get(name)} and ${file}`);
      } else {
        seen.set(name, file);
      }
    }
  });

  if (duplicates.length) {
    fail(`Duplicate function declarations found:\n${duplicates.join('\n')}`);
  }
}

function assertDuplicateTopLevelGlobals(files) {
  const seen = new Map();
  const duplicates = [];
  const declarationPattern = /^(var|let|const)\s+([A-Za-z_$][\w$]*)\b/gm;

  files.forEach((file) => {
    const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    let match;
    while ((match = declarationPattern.exec(source)) !== null) {
      const name = match[2];
      if (seen.has(name)) {
        duplicates.push(`${name}: ${seen.get(name)} and ${file}`);
      } else {
        seen.set(name, file);
      }
    }
  });

  if (duplicates.length) {
    fail(`Duplicate top-level global declarations found:\n${duplicates.join('\n')}`);
  }
}

function assertClaspDeploysOnlyAuthoritativeSource() {
  const claspConfigPath = path.join(projectRoot, '.clasp.json');
  const claspIgnorePath = path.join(projectRoot, '.claspignore');

  if (!fs.existsSync(claspConfigPath)) {
    fail('.clasp.json is missing. Deployment target is not configured.');
    return;
  }

  let claspConfig;
  try {
    claspConfig = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));
  } catch (error) {
    fail(`.clasp.json is not valid JSON: ${error.message}`);
    return;
  }

  const scriptExtensions = claspConfig.scriptExtensions || [];
  if (scriptExtensions.length !== 1 || scriptExtensions[0] !== '.gs') {
    fail('.clasp.json must deploy only authoritative .gs Apps Script files.');
  }

  if (claspConfig.skipSubdirectories !== true) {
    fail('.clasp.json must set skipSubdirectories to true so scripts/ and backups/ are not deployed.');
  }

  if (!fs.existsSync(claspIgnorePath)) {
    fail('.claspignore is missing. Non-authoritative files may be deployed.');
    return;
  }

  const claspIgnore = fs.readFileSync(claspIgnorePath, 'utf8');
  ['*.js', 'scripts/**', 'backups/**', 'package.json', 'README.md'].forEach((pattern) => {
    if (!claspIgnore.includes(pattern)) {
      fail(`.claspignore must include ${pattern}`);
    }
  });
}

function reportDuplicatePairs() {
  const pairs = getRootDuplicatePairs();
  if (!pairs.length) {
    return;
  }

  console.log('Detected non-authoritative root .js duplicate pairs ignored by deployment:');
  pairs.forEach((pair) => {
    const gsSource = fs.readFileSync(path.join(projectRoot, pair.gs), 'utf8');
    const jsSource = fs.readFileSync(path.join(projectRoot, pair.js), 'utf8');
    console.log(`- ${pair.gs} <-> ${pair.js} (${gsSource === jsSource ? 'identical' : 'different'})`);
  });
}

function main() {
  assertRequiredFiles();
  const files = getGsFiles();

  assertSyntax(files);
  assertDuplicateFunctions(files);
  assertDuplicateTopLevelGlobals(files);
  assertClaspDeploysOnlyAuthoritativeSource();
  reportDuplicatePairs();

  if (!process.exitCode) {
    console.log(`Validation passed for ${files.length} Apps Script files.`);
  }
}

main();
