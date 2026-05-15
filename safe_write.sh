#!/usr/bin/env bash
# safe_write.sh — atomic shell write that bypasses Cowork's buffer layer.
# Reads new file content from stdin, writes via a temp-file + mv, then
# invokes verify_edit.sh against the result.
#
# Usage:
#   ./safe_write.sh path/to/file [expected_line_count] <<'XEOF'
#   ...content...
#   XEOF
#
# Why this exists: Cowork's Edit/Write tools have silently truncated large
# files in this folder. Shell here-docs piped through this script perform
# direct, atomic disk writes and verify the result.

set -u

FILE="${1:-}"
EXPECTED_LINES="${2:-}"

if [[ -z "$FILE" ]]; then
  echo "usage: $0 path/to/file [expected_line_count] < new_content" >&2
  exit 64
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="${FILE}.tmp.$$"

cat > "$TMP"
RC=$?
if (( RC != 0 )); then
  echo "ERROR: failed to write temp file $TMP (rc=$RC)" >&2
  rm -f "$TMP"
  exit 70
fi

mv "$TMP" "$FILE"

if [[ -x "$SCRIPT_DIR/verify_edit.sh" ]]; then
  "$SCRIPT_DIR/verify_edit.sh" "$FILE" "$EXPECTED_LINES"
else
  echo "WARN: verify_edit.sh not found next to safe_write.sh — skipping verification." >&2
  wc -l "$FILE"
  wc -c "$FILE"
fi
