const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

// Local test artifacts only. The caller must also use the documented OS sandbox:
// BOP_LOCAL_NETWORK_SANDBOX is an acknowledgment, not network enforcement itself.
async function renderLocalPdf(root, out, name, html) {
  assert.equal(process.env.BOP_LOCAL_NETWORK_SANDBOX, '1',
    'Run PDF validation inside the documented sandbox that denies network access.');
  const htmlPath = path.join(out, name + '.html');
  const pdfPath = path.join(out, name + '.pdf');
  fs.writeFileSync(htmlPath, html);
  const chromeArgs = [
    '--no-sandbox', '--headless=new', '--disable-gpu', '--use-mock-keychain',
    '--disable-breakpad', '--disable-crash-reporter', '--disable-background-networking',
    '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + path.join(out, name.replaceAll(' ', '-') + '-chrome-profile'),
    '--no-pdf-header-footer', '--print-to-pdf=' + pdfPath, 'file://' + htmlPath
  ];
  await new Promise((resolve, reject) => {
    const child = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', chromeArgs,
      { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '', settled = false, completed = false;
    const stopOwnChild = () => {
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    };
    const fail = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { stopOwnChild(); } catch (stopError) { error = stopError; }
      reject(error);
    };
    const timer = setTimeout(() => fail(new Error('Local PDF rendering timed out: ' + stderr.slice(-1000))), 30000);
    child.on('error', fail);
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-8192);
      if (!completed && stderr.includes(' bytes written to file ' + pdfPath)) {
        completed = true;
        // Chromium may stall at shutdown in the outer sandbox. Kill only this
        // fresh test process group after its completed-write acknowledgment.
        try { stopOwnChild(); } catch (error) { fail(error); }
      }
    });
    child.on('close', code => {
      if (settled) return;
      if (!completed) return fail(new Error('Chromium exited before confirming the PDF write (' + code + '): ' + stderr.slice(-1000)));
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
  assert.ok(fs.readFileSync(pdfPath).subarray(0, 5).equals(Buffer.from('%PDF-')));
  const renderDir = path.join(out, 'rendered-pages');
  fs.mkdirSync(renderDir, { recursive: true });
  const pages = execFileSync('swift', [
    path.join(root, 'scripts/render-pdf-pages.swift'), pdfPath,
    path.join(renderDir, name.replaceAll(' ', '-')), path.join(out, name + '.txt')
  ], {
    env: { ...process.env, CLANG_MODULE_CACHE_PATH: path.join(out, 'clang-cache'),
      SWIFT_MODULECACHE_PATH: path.join(out, 'swift-cache') },
    timeout: 120000, encoding: 'utf8'
  }).trim();
  assert.match(pages, /^[1-9]\d*$/);
  fs.writeFileSync(path.join(out, name + '.pages'), pages);
  return Number(pages);
}

module.exports = { renderLocalPdf };
