// @nera-static/plugin-sitemap — a sitemap.xml for every rendered page.
//
// `getAppData` guards the core version (core < 4.13.0 never calls
// `getAssets`, so the build would exit 0 without a sitemap). `getAssets`
// sees the final pagesData, writes the sitemap to `.nera-cache/sitemap/`
// and hands it to core to copy into `public/`. See ROADMAP.md for the
// decisions (D1–D7) behind each step.
//
// Scaffold (ROADMAP slice 2): both hooks are placeholders until slices 3–4.

export function getAppData({ app }) {
    return app
}

export function getAssets() {
    return []
}
