#!/usr/bin/env bash
# verify_edit.sh — sanity check a file after a Cowork write, to catch silent truncation.
#
# Usage:  ./verify_edit.sh path/to/file [expected_line_count]
#
# Prints lines/bytes/tail and warns if the line count is much smaller than expected.
# Repo is not under git, so we can't show a `git diff` truncation block — rely on
# expected_line_count, the tail of the file, and a sanity-check against any sibling
# OneDrive copy if present.

set -u

FILE="${1:-}"
EXPECTED_LINES="${2:-}"

if [[ -z "$FILE" ]]; then
  echo "usage: $0 path/to/file [expected_line_count]" >&2
  exit 64
fi

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: file not found: $FILE" >&2
  exit 66
fi

LINES=$(wc -l < "$FILE")
BYTES=$(wc -c < "$FILE")

echo "=== $FILE ==="
echo "lines: $LINES"
echo "bytes: $BYTES"
echo ""
echo "last 5 lines:"
tail -n 5 "$FILE"
echo ""

if [[ -n "$EXPECTED_LINES" ]]; then
  if (( LINES < EXPECTED_LINES * 90 / 100 )); then
    echo "WARN: line count ($LINES) is <90% of expected ($EXPECTED_LINES)." >&2
    echo "      Possible truncation. Investigate before continuing." >&2
    exit 1
  fi
  echo "OK: line count within 10% of expected ($EXPECTED_LINES)."
fi

# Optional: compare against an OneDrive sibling copy if it exists
SIB="${FILE/Projects\/Claude Cowork/OneDrive\/Documents\/Claude\/Projects}"
if [[ -f "$SIB" ]]; then
  SIB_BYTES=$(wc -c < "$SIB")
  if (( BYTES < SIB_BYTES * 90 / 100 )); then
    echo "WARN: this copy ($BYTES bytes) is <90% of OneDrive sibling ($SIB_BYTES bytes)." >&2
    echo "      Possible truncation. Sibling: $SIB" >&2
    exit 1
  fi
fi

exit 0
