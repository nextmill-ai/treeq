# Project rules for Claude (Cowork)

This project folder has a history of cloud-sync truncation when Cowork's `Edit` and `Write` tools are used on large files. Even after moving canonical from OneDrive to `C:\\Users\\camer\\Projects\\Claude Cowork\\TreeQ\\`, truncation has continued. These rules mitigate the risk.

**Canonical path (do not write elsewhere):** `C:\\Users\\camer\\Projects\\Claude Cowork\\TreeQ\\`. Treat the OneDrive copy at `C:\\Users\\camer\\OneDrive\\Documents\\Claude\\Projects\\TreeQ\\` as read-only legacy.

## File-writing rules

1. **Never** use the `Edit` tool for changes larger than a few lines. Use shell writes via `mcp__workspace__bash`.
   - Full rewrites: `python3 -c "from pathlib import Path; Path(\'FILE\').write_text(CONTENT)"` or `cat > FILE <<\'XEOF\' ... XEOF`.
   - Appends: `cat >> FILE <<\'XEOF\' ... XEOF`.
   - These perform direct, atomic writes and bypass the buffer layer that causes truncation.
2. **Never** use the `Write` tool to overwrite an existing file in this folder if the new content is larger than the old content. Use the shell approach instead.
3. Small `Edit` calls (one-line tweaks, typo fixes) are allowed — but verify afterwards (see below).

## Pre-flight (start of every session)

1. Confirm the canonical project folder is marked "Always keep on this device" if any sync is involved.
2. Note: this folder is **not** under git. The git-based truncation detector from the original rules does not apply. Compensate by always running the verification steps below.

## Verification (after every non-trivial write)

After any write of more than ~20 lines:

1. Read the file back and check the last 5 lines match what was intended.
2. Run `wc -l FILE && wc -c FILE` and compare line/byte count against the expected.
3. Compare size against the source (if copying) — silent truncation usually shows up as a much smaller file with content cut off at an unexpected line.

There is a helper script at the project root: `./verify_edit.sh PATH [EXPECTED_LINE_COUNT]` — run it after any big write.

## If truncation is detected

1. **Do not write to the file again** until restarting the Cowork session.
2. Recover from the OneDrive copy (which has not yet been deleted — see Sources of Truth below).
3. Force a fresh VM by starting a new Cowork session, then retry using the shell write approach above.

## Sources of truth

- **Workbook (Spartan_Pricing_Reference.xlsx):** canonical. Both folders match (MD5 verified 2026-05-12).
- **Production system prompt:** `netlify/functions/_prompts/system.md`. Already incorporates the cleaned workbook rules (8" limb-as-tree, no bucket-truck bundled-min, multiplier order with Priority Scheduling last).
- **Pricing extract for AI prompts:** `research/spartan_pricing_extract.md`. Treat as the source of truth for what the AI assistants see.
- **Memory:** `MEMORY.md` (auto-memory) says canonical is `C:\\Users\\camer\\Projects\\Claude Cowork\\`. Confirm in every session.
