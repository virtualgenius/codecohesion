# Data Files Directory - SAFETY CRITICAL

⚠️ **This directory contains repository analysis data files.**

## 🔒 PROPRIETARY DATA PROTECTION

**NEVER add proprietary Zero repository data to this directory:**
- ❌ `assessor-svc*` (PROPRIETARY)
- ❌ `core-data-svc*` (PROPRIETARY)
- ❌ `public-web*` (PROPRIETARY)

## ✅ Safe Public Repositories

Only these open-source projects may be added:
- cbioportal (open source)
- cbioportal-frontend (open source)
- codecohesion (open source)
- editor (open source)
- gource (open source)
- react (open source)
- test-generated (synthetic test data)

## 🛡️ Safety System

### Automatic Validation

The `npm run deploy` command automatically validates that NO proprietary files exist before deployment:

```bash
cd viewer
npm run deploy  # Runs validate-deploy.sh first
```

### Manual Validation

To check files before deployment:

```bash
cd viewer
./validate-deploy.sh
```

### Whitelist

All allowed files are listed in `SAFE_REPOS.txt`. The validation script will:
- ✅ Allow files in the whitelist
- ❌ BLOCK any file matching proprietary patterns
- ⚠️  Warn about files not in whitelist

## 📝 Adding New Public Repositories

1. Ensure the repository is **open source** (not Zero proprietary)
2. Generate data files using processor
3. Copy files to this directory
4. Add filenames to `SAFE_REPOS.txt`
5. Add repo names to `repos.json`
6. Run `./validate-deploy.sh` to verify
7. Deploy with `npm run deploy`

## 🚨 If Proprietary Data is Added

If you accidentally add proprietary data:

1. **STOP** - Do NOT run `npm run deploy`
2. Delete the proprietary files immediately
3. Run `./validate-deploy.sh` to verify they're gone
4. The validation script will block deployment if they exist

## File Format

Data files must be `.json` and match the CodeCohesion analyzer output format:
- Static snapshots: `repo-name.json`
- Timeline (full delta): `repo-name-timeline-full.json`
