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
  'ExecutiveBusinessIntelligenceEngine.gs',
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

function getFunctionSource(source, functionName) {
  const signature = new RegExp(`function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`);
  const match = signature.exec(source);
  if (!match) {
    fail(`Required function missing: ${functionName}`);
    return '';
  }

  const start = match.index;
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  fail(`Could not parse function body: ${functionName}`);
  return '';
}

function getBlockSource(source, openBraceIndex) {
  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(openBraceIndex, index + 1);
  }
  return '';
}

function assertV1SecurityHardening() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'appsscript.json'), 'utf8'));
  } catch (error) {
    fail(`appsscript.json is not valid JSON: ${error.message}`);
    return;
  }
  const anonymousAccessValue = ['ANYONE', 'ANONYMOUS'].join('_');
  if (manifest.webapp || JSON.stringify(manifest).includes(anonymousAccessValue)) {
    fail('appsscript.json must not declare anonymous web-app access.');
  }

  const menuSource = fs.readFileSync(path.join(projectRoot, 'Menu.gs'), 'utf8');
  const onOpenSource = getFunctionSource(menuSource, 'onOpen');
  const developerConditionIndex = onOpenSource.indexOf('if (developerModeEnabled)');
  const developerBlock = getBlockSource(onOpenSource, onOpenSource.indexOf('{', developerConditionIndex));
  const resetTestItem = ".addItem('Reset Test Data', 'resetTestData')";
  const resetDemoItem = ".addItem('Reset Demo Data', 'resetDemoData')";
  if (!/isDeveloperModeEnabledReadOnly_\(\)/.test(onOpenSource) ||
      developerConditionIndex < 0 ||
      !developerBlock.includes(resetTestItem) ||
      !developerBlock.includes(resetDemoItem) ||
      onOpenSource.split(resetTestItem).length !== 2 ||
      onOpenSource.split(resetDemoItem).length !== 2) {
    fail('Reset menu actions must be added only through read-only developer-mode logic.');
  }

  [
    ['SheetHelpers.gs', 'resetTestData'],
    ['DemoData.gs', 'resetDemoData']
  ].forEach(([file, functionName]) => {
    const source = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    const functionSource = getFunctionSource(source, functionName);
    const guardIndex = functionSource.indexOf('if (!isDeveloperModeEnabledReadOnly_())');
    const confirmationIndex = functionSource.indexOf('const response = ui.alert');
    const demoConfirmationIndex = functionSource.indexOf('const confirm = ui.alert');
    const destructiveFlowIndex = confirmationIndex >= 0 ? confirmationIndex : demoConfirmationIndex;
    if (guardIndex < 0 || destructiveFlowIndex < 0 || guardIndex > destructiveFlowIndex ||
        !/available only in Developer Mode/.test(functionSource)) {
      fail(`${functionName} must refuse execution outside Developer Mode before confirmation or destructive work.`);
    }
  });

  const helperSource = fs.readFileSync(path.join(projectRoot, 'InspectionPlayground.gs'), 'utf8');
  const readOnlyHelper = getFunctionSource(helperSource, 'isDeveloperModeEnabledReadOnly_');
  if (!/getActiveSpreadsheet\(\)/.test(readOnlyHelper) ||
      !/getSheetByName\(['"]Settings['"]\)/.test(readOnlyHelper) ||
      !/findSystemDeveloperModeValue_/.test(readOnlyHelper) ||
      !/findLegacyDeveloperModeValue_/.test(readOnlyHelper) ||
      !/isDeveloperModeTrueValue_/.test(readOnlyHelper)) {
    fail('Read-only developer-mode helper must inspect only the existing Settings sheet with existing read helpers.');
  }
  if (/ensureSystemSettingsSection_|insertSheet|insertRow|deleteRow|setValue|setValues|clear(Content)?|formatSystemSettingsSection_/.test(readOnlyHelper)) {
    fail('Read-only developer-mode helper must not repair or mutate the workbook.');
  }
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
  assertV1SecurityHardening();
  reportDuplicatePairs();

  if (!process.exitCode) {
    console.log(`Validation passed for ${files.length} Apps Script files.`);
  }
}

main();
