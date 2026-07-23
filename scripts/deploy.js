#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const defaultProjectRoot = path.resolve(__dirname, '..');
const TARGETS = {
  acceptance: {
    label: 'ACCEPTANCE (disposable)',
    configFile: '.clasp.json',
    confirmation: 'DEPLOY ACCEPTANCE'
  },
  production: {
    label: 'PRODUCTION',
    configFile: '.clasp.production.json',
    confirmation: 'DEPLOY PRODUCTION'
  }
};

function commandExists(command) {
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  const paths = (process.env.PATH || '').split(path.delimiter);
  return paths.some((directory) => extensions.some((extension) => (
    fs.existsSync(path.join(directory, command + extension))
  )));
}

function runCommand(command, args, projectRoot = defaultProjectRoot) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status || 1}.`);
  }
}

function captureCommand(command, args, projectRoot = defaultProjectRoot) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  }
  return result.stdout.trim();
}

function askConfirmation(promptText) {
  return new Promise((resolve) => {
    const input = readline.createInterface({ input: process.stdin, output: process.stdout });
    input.question(`${promptText}\n> `, (answer) => {
      input.close();
      resolve(answer);
    });
  });
}

function readTargetConfig(projectRoot, targetName) {
  const target = TARGETS[targetName];
  if (!target) {
    throw new Error(`Invalid deployment target "${targetName || ''}". Use acceptance or production.`);
  }
  const configPath = path.join(projectRoot, target.configFile);
  if (!fs.existsSync(configPath)) {
    throw new Error(`${target.configFile} not found for the ${targetName} target.`);
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`${target.configFile} is not valid JSON: ${error.message}`);
  }
  if (!config.scriptId) {
    throw new Error(`${target.configFile} does not contain a Script ID.`);
  }
  return { ...target, configPath, config };
}

function assertProductionGitSafety(projectRoot, capture = captureCommand, environment = process.env) {
  const dirty = capture('git', ['status', '--porcelain'], projectRoot);
  if (dirty) {
    throw new Error('Production deployment refused: the working tree is not clean.');
  }
  const branch = capture('git', ['branch', '--show-current'], projectRoot);
  if (!branch) {
    throw new Error('Production deployment refused: detached HEAD is not allowed.');
  }
  if (branch !== 'main' && environment.APPROVED_RELEASE_BRANCH !== branch) {
    throw new Error(
      `Production deployment refused from branch "${branch}". Use main or explicitly approve this exact release branch with APPROVED_RELEASE_BRANCH=${branch}.`
    );
  }
}

async function deploy(targetName, options = {}) {
  const projectRoot = options.projectRoot || defaultProjectRoot;
  const run = options.run || runCommand;
  const capture = options.capture || captureCommand;
  const confirm = options.confirm || askConfirmation;
  const exists = options.commandExists || commandExists;
  const environment = options.environment || process.env;
  const target = readTargetConfig(projectRoot, targetName);

  console.log(`Deployment target: ${target.label}`);
  console.log(`Configuration: ${target.configFile}`);
  console.log(`Script ID: ${target.config.scriptId}`);

  if (!exists('clasp')) {
    throw new Error('clasp is not installed. Install it with: npm install -g @google/clasp');
  }

  const answer = await confirm(`Type ${target.confirmation} exactly to continue:`);
  if (answer !== target.confirmation) {
    throw new Error(`Deployment cancelled: confirmation did not exactly match ${target.confirmation}.`);
  }

  if (targetName === 'production') {
    assertProductionGitSafety(projectRoot, capture, environment);
    run('npm', ['run', 'validate'], projectRoot);
    run('npm', ['run', 'test:lifecycle'], projectRoot);
    run('npm', ['run', 'test:audit-rendering'], projectRoot);
    run('npm', ['run', 'test:ebi'], projectRoot);
    run('npm', ['test'], projectRoot);
    run('git', ['diff', '--check'], projectRoot);
    assertProductionGitSafety(projectRoot, capture, environment);
  } else {
    run('npm', ['run', 'validate'], projectRoot);
  }

  run('npm', ['run', 'backup'], projectRoot);

  if (targetName === 'acceptance') {
    run('clasp', ['push'], projectRoot);
    return;
  }

  const acceptancePath = path.join(projectRoot, '.clasp.json');
  if (!fs.existsSync(acceptancePath)) {
    throw new Error('.clasp.json not found; production deployment cannot safely preserve and restore the acceptance configuration.');
  }
  const original = fs.readFileSync(acceptancePath);
  const originalMode = fs.statSync(acceptancePath).mode;
  try {
    fs.copyFileSync(target.configPath, acceptancePath);
    run('clasp', ['push'], projectRoot);
  } finally {
    fs.writeFileSync(acceptancePath, original, { mode: originalMode });
  }
}

async function main() {
  const targetName = process.argv[2];
  if (!targetName) {
    throw new Error('Deployment target is required. Use acceptance or production.');
  }
  await deploy(targetName);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { TARGETS, assertProductionGitSafety, deploy, readTargetConfig };
