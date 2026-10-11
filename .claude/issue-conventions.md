# Issue conventions

Review rules for work on `@nera-static/plugin-sitemap`, run through Snagio from
`nera-plugin-sitemap/`. The Snagio project **"Nera AI"** tracks
`../nera-cli/ROADMAP-ai.md` (this plugin is its **L8**); its issues carry the target
repo as a title prefix. **Work an issue only from the repo it names** — the step
skills commit in the current repo.

The workspace `../CLAUDE.md` holds the fleet-wide rules (semver, CHANGELOG,
releases, plugin contract, publishing a brand-new package); this file only adds what
a reviewer checks per diff. To set up the next new plugin repo, copy this file and
swap the names (see "Starting a new repo for a Snagio issue" in `../CLAUDE.md`).

## Non-negotiables

- **`ROADMAP.md` in this repo is the plugin's spec and single source of truth**
  (created by the first issue; `ROADMAP-ai.md` L8 only points to it). A decision made
  while working an issue is written back into it in the same commit — never only into
  the issue. Extend it, never fork it.
- **Semver + `CHANGELOG.md` in the same commit as the change** (Keep a Changelog,
  four-space bullets, `**BREAKING**:` prefix). Bump with
  `npm version <bump> --no-git-tag-version`, never by hand-editing `package.json`.
  Config keys, the `app.<key>`/`meta.<key>` the plugin writes, the output path and the
  XML shape are the public contract — classify changes by what an existing site
  would notice.
- **Never publish or push.** No `npm publish`, no `git push`, no tags pushed, no repo
  created on GitHub, no posts anywhere public. The maintainer does the one-time
  bootstrap publish of 1.0.0 by hand, then a CI-published x.y.1 within ~2 days so the
  Trusted Publisher does not expire; the session hands over the exact commands.
- **Never write into `public/` from a hook.** Plugins run before core deletes
  `public/`, so a direct write is lost. Generated files reach the output through the
  `getAssets` hook (core ≥ 4.13.0), and the plugin fails loudly on an older core.
- **Hooks stay synchronous** and return the right shape (`getAppData` → plain object,
  `getMetaData` → array, `getAssets` → `[{ from, to }]`); a wrong shape is dropped
  silently by core.
- Config is read from the **site** (`config/sitemap.yaml` via `getConfig` from
  `@nera-static/plugin-utils`), every key has a JS fallback, and a missing config file
  still yields a working sitemap.
- Paste-ready text for the maintainer goes in a fenced code block between
  `----- START: … -----` and `----- END -----` lines, never in a blockquote.

## Framework correctness

- ESM only; `engines` matches the floor of the real dependencies (at least core's
  `^20.19.0 || >=22.0.0`); eslint style: 4-space indent, no semicolons, single quotes.
  No new runtime dependency without a stated reason — every site installs this one.
- URLs are absolute (`origin` in `app.yaml`, else canonical-links' `app_origin`), honour
  `base_path`, are XML-escaped, and follow the sitemaps.org protocol; `lastmod` comes
  from frontmatter `date`/`createdAt`, never from file birth time (CI stamps every
  file the same date).
- Pages without `layout` are never rendered by core, so they never appear in the
  sitemap. Multilingual sites (`meta.lang`) are handled deliberately — what the
  ROADMAP decides, not by accident.
- Output is deterministic: the same site gives a byte-identical `sitemap.xml`.

## UI / template rules

- No Pug views unless the ROADMAP decides otherwise; if any ship, their markup and
  BEM classes are a public contract (changes are major) and they are published via
  `npm run publish-template`.
- Interface language of messages and docs: English. Warnings say what is wrong,
  where, and what to do.

## UI walkthrough

The plugin has no interactive UI, so a browser test is normally skipped. When one is
wanted:

- Browser tooling: Playwright MCP (`mcp__playwright__browser_navigate`,
  `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_console_messages`).
- Boot (a throwaway site with the *local* plugin, never from npm):
  `R=$PWD; T=$(mktemp -d) && cd "$T" && npx @nera-static/nera new site --no-install && cd site && npm install && npm install "$R" && npx nera build && npx nera serve --port 3124`
  (Node 22 if npm crashes: `PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH`). Delete
  `$T` afterwards.
- Base URL / login: http://localhost:3124/, no login.
- Surfaces:
    | surface | url | role | how to open |
    |---|---|---|---|
    | generated sitemap | `/sitemap.xml` | crawler | open the URL |
    | `robots.txt` pointer (if the ROADMAP ships it) | `/robots.txt` | crawler | open the URL |

## Tests & hygiene

- `npx vitest run && npm run lint` must pass (`npm test` is watch mode — never use
  it here). Run from the package root.
- New behaviour has a test in `test/`: unit tests for URL building, escaping and
  config fallbacks; an integration test that builds a throwaway site in a temp
  directory through `@nera-static/core`'s `run()` and asserts on the written
  `public/sitemap.xml`. No network.
- Generate the lockfile with npm ≥ 10.9 (Node 22, see the boot line); commit it
  before any workflow that runs `npm ci`.
- The repo matches the fleet: `.github/workflows/test.yml` and `publish.yml` copied
  from a recent plugin (`../nera-plugin-code-blocks`), `LICENSE`, `README.md` linking
  https://nera.js.org, `files` in `package.json` limited to what ships.

## Reconciliation steps (run when resolving an issue)

- Version bump + `CHANGELOG.md` entry in the change's commit, if it ships in the
  tarball; none for ROADMAP, tests, CI or `.claude/`.
- Update this repo's `ROADMAP.md` (slice done, date, choices made) and, when a slice
  of L8 completes, the L8 status in `../nera-cli/ROADMAP-ai.md`.
- On the first release: add the plugin to `../generator/PLUGINS.md` (alphabetical,
  bump the count) and to the three website catalogs in `../nera-website/pages/`
  (`plugins/`, `de/plugins/`, `es/plugins/`, translated descriptions, no raw `: `).
  Those are commits in other repos — hand them over or file them as issues, as the
  maintainer prefers.
- Hand over the release commands (GitHub repo creation, `git push`, bootstrap
  `npm publish`, `git tag -a v<x.y.z> …`) — do not run them.
