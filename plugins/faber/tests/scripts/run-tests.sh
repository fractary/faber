#!/usr/bin/env bash
# run-tests.sh - Run the plugin script tests
#
# Usage: plugins/faber/tests/scripts/run-tests.sh [test-file ...]
# Runs every test-*.sh in this folder when no file is given. Requires bash 4+,
# jq and python3.

set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -gt 0 ]]; then
    FILES=("$@")
else
    FILES=("$TEST_DIR"/test-*.sh)
fi

FAILED=()
for file in "${FILES[@]}"; do
    echo "$(basename "$file")"
    if ! bash "$file"; then
        FAILED+=("$(basename "$file")")
    fi
done

if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo ""
    echo "Failed: ${FAILED[*]}"
    exit 1
fi
echo ""
echo "All script tests passed"
