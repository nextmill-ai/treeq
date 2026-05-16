# Cursor setup — TreeQ

A walkthrough for getting Cursor configured for this project. Run through it once on a fresh install; after that, opening the folder is enough.

## 1. Install + sign in

1. Download Cursor from `https://cursor.com/download`.
2. Sign in with the same Google account you use for everything else (`cameronemiller3@gmail.com`).
3. On first open, pick **"Open Folder"** and choose `C:\Users\camer\Projects\Claude Cowork\TreeQ\`. **Do not open the OneDrive copy.**

## 2. Model selection — via OpenRouter

You're routing Cursor through OpenRouter for chat/inline-edit. This unlocks any model OpenRouter offers (Claude, GPT, Gemini, Grok, open-source) on one bill, with one dashboard. **It does not replace** Cursor's Tab autocomplete or Composer auto-mode — those stay on Cursor's hosted infra.

Setup:

1. Generate an OpenRouter key at `https://openrouter.ai/keys`. Fund the account with $10–20 to start; usage is pay-per-token (provider cost + ~5% markup).
2. Open `Settings → Models`.
3. Scroll to **OpenAI API Key**. Toggle **"Override OpenAI Base URL"** on.
4. Base URL: `https://openrouter.ai/api/v1`
5. API key: paste the OpenRouter key.
6. Click **Verify**. Should turn green.
7. Scroll up to the model list. Click **"+ Add model"** and add OpenRouter model IDs by hand:
   - `anthropic/claude-sonnet-4.6` — daily driver
   - `anthropic/claude-opus-4.6` — hard problems (pricing-engine math, schema migrations)
   - `openai/gpt-5` — second opinion / when Claude refuses something benign
   - `x-ai/grok-4-fast` — cheap throwaway prompts
8. Toggle off the Cursor-hosted entries you won't use, so the picker stays clean.

Defaults to set:
- **Default chat model:** `anthropic/claude-sonnet-4.6`.
- **Hard-problem model:** `anthropic/claude-opus-4.6` — switch with Cmd-K → "Switch model".

### What stays on Cursor's infra (not OpenRouter)

- **Tab autocomplete** — Cursor's proprietary small model. Can't be routed. If you keep Cursor Pro ($20/mo), Tab works freely; if you cancel, it gets rate-limited.
- **Composer / Agent auto-mode** — tuned for Cursor-hosted models. May error or degrade with OpenRouter models. Use Composer sparingly; prefer Claude Code for big refactors (it respects the shell-here-doc discipline in CLAUDE.md).
- **"Auto" model picker** — only picks from Cursor's hosted set. Pick your OpenRouter model explicitly.

Most people keep a Cursor Pro sub *and* use OpenRouter on top. If you cancel Pro entirely, you lose Tab + auto-mode + Composer but keep chat/inline-edit through OpenRouter.

## 3. API keys — three separate things, don't confuse them

| Key | Lives in | Used by | Cost-bearer |
|---|---|---|---|
| OpenRouter key | Cursor `Settings → Models` | Cursor chat + Cmd-K | OpenRouter |
| `ANTHROPIC_API_KEY` | `.env` (gitignored) | `netlify/functions/treeq-ai.js` runtime estimator | Anthropic direct |
| `OPENAI_API_KEY` | `.env` | `transcribe.js`, embeddings in `sync-notion.js` | OpenAI direct |

The OpenRouter key in Cursor and the `ANTHROPIC_API_KEY` in `.env` are **completely separate** — Cursor's chat going through OpenRouter doesn't change how the deployed app calls Anthropic. Optionally you can later route the app through OpenRouter too (swap to OpenAI SDK with base URL override), but it's not load-bearing.

Mirror runtime keys into Netlify with `netlify env:set KEY value`. Never mirror the OpenRouter key — it has no role at runtime.

## 4. MCP servers

The repo includes `.cursor/mcp.json` wired for **Supabase**, **GitHub**, **filesystem**, and **Notion**. To activate:

1. Open `Settings → MCP → Add new MCP Server` — or just toggle the existing entries on once Cursor picks up the file.
2. Set environment variables in your shell (PowerShell):
```powershell
   setx SUPABASE_ACCESS_TOKEN "sbp_..."
   setx SUPABASE_PROJECT_REF "<your-project-ref>"
   setx GITHUB_PERSONAL_ACCESS_TOKEN "ghp_..."
   setx NOTION_TOKEN "secret_..."
```
   Restart Cursor after `setx` so it picks up the env.
3. Verify each server shows a green dot in `Settings → MCP`. If red, click the row to see stderr.

`NOTION_TOKEN` can hold the same value as `NOTION_API_KEY` in `.env` — the MCP server just needs an env var by that specific name.

**Token scopes:** GitHub PAT `repo` + `read:org`; Supabase token from `https://supabase.com/dashboard/account/tokens`; Notion integration token from `https://www.notion.so/profile/integrations` (share the operational DBs with the integration after creating).

## 5. Extensions

Cursor will prompt to install workspace-recommended extensions when you open the folder. The list lives in `.vscode/extensions.json`. Highlights: Prettier, ESLint, Supabase, SQLTools + pg driver, DotENV, GitLens, Error Lens, Ionic (Capacitor tooling), Code Spell Checker.

## 6. Project rules

Already wired: `.cursor/rules/treeq.mdc` with `alwaysApply: true`. Includes canonical-path rule, methodology-stays-server-side rule, Spartan pricing invariants, and file-write discipline from `CLAUDE.md`. Add more rules via `Cmd-Shift-P → "New Cursor Rule"`.

## 7. .cursorignore

Already wired. Excludes `node_modules`, build output, secrets, `species_data/city_inventories.json`, and `.xlsx` files. Adjust as the codebase grows.

## 8. Agent vs Chat vs Tab

- **Tab** (autocomplete): leave on. Cursor's own model — cheap, fast, can't be routed through OpenRouter.
- **Cmd-K** (inline edit): routes through OpenRouter once configured. Use for one-off line/block changes.
- **Chat** (Cmd-L): routes through OpenRouter. Use for "explain this" and small edits with file references.
- **Agent / Composer** (Cmd-I): tuned for Cursor-hosted models — may degrade with OpenRouter. For larger refactors prefer Claude Code.

## 9. Sanity check

1. Open `netlify/functions/_prompts/system.md` and ask the chat (Sonnet 4.6 via OpenRouter): "What is the multiplier order rule for Spartan pricing?" — it should cite Priority Scheduling last.
2. Confirm the request appears at `https://openrouter.ai/activity` within a few seconds.
3. Open the Supabase panel in the sidebar; you should see your project's tables.
4. Run `npm run dev` in Cursor's integrated terminal — should boot Netlify dev.

If any of those fail, see CLAUDE.md and the canonical project README.
