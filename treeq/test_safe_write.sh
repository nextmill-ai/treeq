#!/usr/bin/env bash
# test_safe_write.sh — round-trip exercise of safe_write.sh + verify_edit.sh.
# Writes a throwaway file with a known line count, verifies, then cleans up.

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/_safe_write_test.tmp"
EXPECTED=30

# Build content with a deterministic last line so verify_edit.sh's tail output is checkable.
{
  echo "# safe_write.sh round-trip test"
  echo "# generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  for i in $(seq 1 27); do
    echo "line $i — quick brown fox jumps over the lazy dog"
  done
  echo "END-OF-TEST-FILE-MARKER"
} | "$SCRIPT_DIR/safe_write.sh" "$TARGET" "$EXPECTED"

RC=$?
echo ""
echo "=== round-trip result ==="
if (( RC == 0 )); then
  echo "PASS: safe_write.sh exited 0"
else
  echo "FAIL: safe_write.sh exited $RC"
fi

# Independent re-check (don't trust the script we're testing)
ACTUAL_LINES=$(wc -l < "$TARGET")
LAST_LINE=$(tail -n 1 "$TARGET")
echo "independent recount: $ACTUAL_LINES lines"
echo "last line: $LAST_LINE"

if [[ "$LAST_LINE" == "END-OF-TEST-FILE-MARKER" && "$ACTUAL_LINES" -eq "$EXPECTED" ]]; then
  echo "INDEPENDENT PASS"
else
  echo "INDEPENDENT FAIL — file may have been truncated"
fi

rm -f "$TARGET"
echo "cleanup: removed $TARGET"
