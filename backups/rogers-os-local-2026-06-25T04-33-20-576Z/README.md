# Rogers Holdings OS

Google Workspace-based operating system for Rogers Holdings LLC.

## Rogers Holdings OS Deployment

This folder is set up for safe local deployment to the live Rogers Holdings OS Google Apps Script project using `clasp`.

### One-time setup

1. Install clasp:

   ```bash
   npm install -g @google/clasp
   ```

2. Log in to Google:

   ```bash
   clasp login
   ```

3. Link this folder to the Rogers Holdings OS Apps Script project.

   Preferred existing-project flow:

   ```bash
   clasp clone <SCRIPT_ID>
   ```

   If the local files already exist and you only need to link the folder, create a `.clasp.json` file with the confirmed Apps Script project ID:

   ```json
   {
     "scriptId": "PASTE_ROGERS_HOLDINGS_OS_SCRIPT_ID_HERE",
     "rootDir": "",
     "scriptExtensions": [
       ".gs"
     ],
     "htmlExtensions": [
       ".html"
     ],
     "jsonExtensions": [
       ".json"
     ],
     "filePushOrder": [],
     "skipSubdirectories": true
   }
   ```

   Confirm the project ID from the Apps Script project settings before deploying.

4. Check local deployment readiness:

   ```bash
   npm run status
   ```

### Validate before deployment

Run:

```bash
npm run validate
```

Validation checks:

- Required `.gs` files exist.
- Apps Script files parse as JavaScript.
- Duplicate function names are not present.
- Duplicate top-level `var` / `let` / `const` globals are not present.
- `.clasp.json` deploys only authoritative `.gs` source files.
- Root `.js` duplicate pairs are reported and ignored by deployment.

### Authoritative source policy

The authoritative Rogers Holdings OS Apps Script source is the root `.gs` files.

Root `.js` files with the same basename are non-authoritative duplicates and must not be deployed. The deployment workflow enforces this with:

- `.clasp.json` `scriptExtensions: [".gs"]`
- `.clasp.json` `skipSubdirectories: true`
- `.claspignore` rules that exclude root `.js`, `scripts/`, `backups/`, extracted assets, and local project metadata

Keep `scripts/` as local Node utilities only.

### Create a local backup

Run:

```bash
npm run backup
```

Backups are written to:

```text
backups/rogers-os-local-<timestamp>/
```

### Deploy to Apps Script

Run:

```bash
npm run deploy
```

Deployment flow:

1. Runs validation.
2. Creates a local backup.
3. Confirms `clasp` is installed.
4. Confirms `.clasp.json` exists.
5. Runs:

   ```bash
   clasp push
   ```

This workflow does not deploy automatically unless `npm run deploy` is explicitly run.

### Production safety rules

- Do not run `clasp push` until `npm run validate` passes.
- Confirm `.clasp.json` points to the Rogers Holdings OS Apps Script project before deploying.
- Use `npm run backup` before significant changes.
- If Apps Script indexing fails after deployment, restore the last known-good local backup and push again.
