#!/bin/bash
# Pre-deployment validation script
# Ensures ONLY safe public data files are deployed to production

set -e

SAFE_LIST="public/data/SAFE_REPOS.txt"
DATA_DIR="public/data"
PROPRIETARY_LIST=".proprietary-repos.txt"

echo "🔒 Validating data files before deployment..."

# Check if safe list exists
if [ ! -f "$SAFE_LIST" ]; then
  echo "❌ ERROR: SAFE_REPOS.txt not found!"
  exit 1
fi

# Check if proprietary patterns list exists
if [ ! -f "$PROPRIETARY_LIST" ]; then
  echo "❌ ERROR: .proprietary-repos.txt not found!"
  echo "   Create this file with proprietary repo patterns (one per line)"
  exit 1
fi

# Get list of actual JSON files
ACTUAL_FILES=$(find "$DATA_DIR" -name "*.json" -type f -exec basename {} \; | sort)

# Get list of allowed files (skip comments and empty lines)
ALLOWED_FILES=$(grep -v '^#' "$SAFE_LIST" | grep -v '^$' | grep '\.json$' | sort)

# Load proprietary patterns from gitignored config file
BLOCKED_PATTERNS=()
while IFS= read -r pattern; do
  # Skip comments and empty lines
  [[ "$pattern" =~ ^#.*$ ]] && continue
  [[ -z "$pattern" ]] && continue
  BLOCKED_PATTERNS+=("$pattern")
done < "$PROPRIETARY_LIST"

for file in $ACTUAL_FILES; do
  for pattern in "${BLOCKED_PATTERNS[@]}"; do
    if [[ "$file" == *"$pattern"* ]]; then
      echo "❌ BLOCKED: Found proprietary file: $file"
      echo "❌ DEPLOYMENT ABORTED - Remove this file before deploying!"
      exit 1
    fi
  done

  # Check if file is in whitelist
  if ! echo "$ALLOWED_FILES" | grep -q "^$file$"; then
    echo "⚠️  WARNING: File not in whitelist: $file"
    echo "   Add it to SAFE_REPOS.txt if it should be deployed"
  fi
done

echo "✅ Validation passed - no proprietary files detected"
echo "📦 Safe to deploy"
exit 0
