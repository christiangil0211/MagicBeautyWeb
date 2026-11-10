# Advent landing implementation plan
Goal: Implement the supplied desktop/mobile references at /calendarios-de-adviento, locally only.
Spec: C:/Users/User/.codex/attachments/a511ed5f-7d9b-44b4-ab36-271c94654d3b/Pasted text.txt
Architecture: Static standalone Angular component under PublicLayout; route-specific SEO and prerender; existing sitemap path list.
Constraints: Preserve the existing portal-banner edit; no commits, publication, dependencies, database or catalog pricing changes.
Ruling: Use the already selected feature/advent-calendar-2026 checkouts; no additional branch or worktree.
Ruling: No original product photographs are accessible. Clearly labeled temporary artwork is authorized by the spec. Do not derive counterfeit product photos from mockups.
Ruling: The source brief and approved mockups authorize implementation; execute without another approval gate.

- [x] 1. Add component tests for all four calendars, exact retail/wholesale prices and quantities, pending states, WhatsApp intent and safe links. Run and observe missing component failure.
- [x] 2. Implement advent-calendar.component.ts/html/scss. Static data, individual WhatsApp links, four cards, four steps, five expandable condition categories. No carousel without real photos.
- [x] 3. Register standalone public route ahead of portal matching; prerender; route SEO title, description, canonical and OG. Preserve existing route behavior. Test via existing SEO harness.
- [x] 4. Add campaign URL to existing sitemap and update its exact-list test in backend checkout and matching sources in public checkout. Run SitemapTests without database services (in-memory only).
- [x] 5. Run production build and pertinent component, route, SEO and portal tests. Inspect generated HTML, links and browser layouts at phone/tablet/desktop and very wide widths. Review final diff.

Review focus: missing assets must be explicit; pending prices must never become zero or sold out; anonymous/session routes both work; no automatic reservation/notification claims; mobile horizontal cards must remain legible with expanded terms and zoom.

Verification: Production build succeeded; 84 relevant frontend tests passed; 8 backend SitemapTests passed. Chrome JavaScript/hydration preview passed at 320, 375, 430, 700, 768, 1024, 1280, 1535, 1920 and 3834px, with no horizontal overflow, clipped card text, off-center collection or runtime exceptions. Five native details controls open correctly. Canonical and all four personalized WhatsApp links verified. Static HTML contains title, four calendar cards, confirmed prices and five conditions.
Review: Independent code review found a decorative question mark and a Spanish grammar issue; both corrected. Icon font inheritance corrected after screenshot inspection.
Pending: User will supply original photographs at the end. No product photography, brand wordmark assets or conceptual package claims fabricated. Campaign currently uses the existing general brand OG image.
Warnings: Existing public layout CSS exceeds warning budget. Existing .NET restore reports NU1902/NU1903 for System.Security.Cryptography.Pkcs 9.0.4; no dependencies changed.
Delivery: No commits, push, merge, deployment, migrations or catalog changes. Sitemap and exact-list test synchronized in both checkouts.

Photo follow-up: Integrated 11 original assets supplied by user: Trendy 1/2/3, Purpure 1/2/3, Bloomshell 1/2/3, Magic 1/3. User confirmed these are the available Magic assets. Independent manual galleries with thumbnails, contain sizing and descriptive alt text replace temporary artwork. Trendy remains visible as sold out without price or reservation link. Magic images retain conceptual labeling. Relevant frontend tests: 49 passed. Chrome verified 320/375/768/1280/1535/1920px, gallery independence and image loading.
