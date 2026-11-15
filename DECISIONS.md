# Decisions Log

Every assumption or design choice not specified in the project brief is logged here.

| # | Decision | Reason |
|---|----------|--------|
| 1 | Using `pnpm` as package manager | Faster installs, strict dependency resolution, disk-efficient |
| 2 | TMDB API v3 (not v4) | v3 is the most widely documented; the free tier is sufficient for non-commercial use |
| 3 | Profile data stored in localStorage with JSON serialization | Brief says "localStorage first"; Supabase is optional/later |
| 4 | Using `react-router-dom` v7 (latest stable) | Brief says "React Router" without specifying version |
| 5 | Zustand stores are per-feature (profiles, watchlist, providers) rather than one monolith | Better separation of concerns per the agent ownership model |
| 6 | Video.js 8 with default skin, customized via CSS to match dark theme | Brief says "Video.js 8" |
| 7 | Content details shown in a modal overlay, not a separate page | Brief specifies "Content Details Modal" |
| 8 | Episode selector in details modal uses accordion per season | Simplest UX for season/episode browsing |
| 9 | `library.json` in `public/` contains legal video entries with direct URLs | Brief section 5.2 specifies this pattern |
| 10 | AddonProvider settings stored in localStorage alongside profile data | No backend in v1; consistent with other local storage |
