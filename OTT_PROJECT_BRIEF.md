# OTT Web Platform - Project Brief (for AI agents)

Read this whole file before writing any code. Follow it exactly. If something is unclear, make the simplest choice and write it in `DECISIONS.md`.

## 1. Goal

Build a Netflix-style streaming web app (web only, no native apps). It must run well on low-end devices and deploy free on Vercel / Netlify / Cloudflare Pages.

## 2. Features (v1 only)

1. Profiles (pick, create, delete; avatar + name)
2. Home page: hero banner + horizontal poster rows
3. Movies page and TV Shows page (grid + genre filter)
4. Search (debounced, 300 ms)
5. Content Details Modal (poster, backdrop, title, year, rating, genres, overview, cast, Play button, episode list for shows)
6. Player page using Video.js
7. My List (watchlist) and Continue Watching, per profile

Non-goals for v1: payments, comments, downloads, Android/desktop apps, user-uploaded video, admin panel.

## 3. Stack

```
React 18 + Vite + TypeScript
Tailwind CSS
Video.js 8 + @videojs/http-streaming (HLS)
React Router
Zustand (small global state)
Profiles/watchlist: localStorage first, Supabase later (optional)
No custom backend in v1
```

## 4. Folder structure and ownership

Each agent edits ONLY its own folders. Shared files are changed only by the Lead agent.

```
src/
  app/            # Lead: routing, layout, providers
  types/          # Lead: shared types (see section 6)
  ui/             # Agent UI: Navbar, Hero, Row, PosterCard, Grid, Skeletons
  pages/          # Agent UI: Home, Movies, Shows, Search
  data/           # Agent DATA: providers, API clients, hooks
  details/        # Agent PLAYER: DetailsModal
  player/         # Agent PLAYER: Video.js wrapper, Player page
  profiles/       # Agent PROFILES: profile screen, store, watchlist, progress
  qa/             # Agent QA: tests, screenshots, reports
```

## 5. Content sources (IMPORTANT)

The app reads content only through a **provider interface**. The app ships with NO pirate add-ons and NO hardcoded stream links to copyrighted content.

```ts
interface ContentProvider {
  id: string;
  getCatalog(type: 'movie' | 'series', catalogId: string, page?: number): Promise<MediaItem[]>;
  search(query: string): Promise<MediaItem[]>;
  getMeta(type: 'movie' | 'series', id: string): Promise<MediaDetails>;
  getStreams(type: 'movie' | 'series', id: string, episode?: EpisodeRef): Promise<StreamSource[]>;
}
```

Providers to build:

1. **TmdbProvider** (metadata + posters only, no streams)
   - Free API, non-commercial. Show the TMDB logo and the line: "This product uses the TMDB API but is not endorsed or certified by TMDB."
   - Image base: `https://image.tmdb.org/t/p/w500` (posters), `/w1280` (backdrops)
   - Key from `import.meta.env.VITE_TMDB_KEY`. Never commit the key.
2. **LegalVideoProvider** (streams that are legal to play)
   - Internet Archive public-domain films, Blender open movies, and the user's own hosted MP4/HLS files, described in `public/library.json`.
3. **AddonProvider** (Stremio add-on protocol, optional)
   - The user pastes an add-on URL in Settings. Nothing is preinstalled.
   - Protocol (plain HTTP JSON):
     ```
     {addon}/manifest.json
     {addon}/catalog/{type}/{id}.json
     {addon}/meta/{type}/{id}.json
     {addon}/stream/{type}/{id}.json
     ```
   - Only use streams that return a direct `url` (MP4 or HLS). Ignore `infoHash` (torrent) streams: browsers cannot play them without a server.
   - Handle CORS errors gracefully with a clear message.

## 6. Shared types (Lead creates `src/types/index.ts` first)

```ts
type MediaType = 'movie' | 'series';

interface MediaItem {
  id: string;            // imdb id or tmdb id
  type: MediaType;
  title: string;
  year?: number;
  poster?: string;
  backdrop?: string;
  rating?: number;
}

interface MediaDetails extends MediaItem {
  overview: string;
  genres: string[];
  runtime?: number;
  cast: { name: string; character?: string }[];
  seasons?: { season: number; episodes: { episode: number; title: string; overview?: string }[] }[];
}

interface StreamSource {
  url: string;
  type: 'video/mp4' | 'application/x-mpegURL';
  label: string;
  subtitles?: { lang: string; url: string }[];
}
```

## 7. UI spec (Netflix-style)

- Dark theme. Background `#141414`, accent `#E50914`, text white/gray.
- Fixed Navbar: logo, Home, Movies, TV Shows, My List, Search icon, profile avatar. Transparent at top, solid on scroll.
- Hero: large backdrop, gradient overlay, title, 2-line overview, Play and More Info buttons.
- Rows: title + horizontal scroll with snap, arrows on desktop, swipe on mobile. Posters ratio 2:3, lazy-loaded.
- Details Modal: opens over the page, closes with Esc, outside click, and a close button. Locks body scroll. Focus is trapped inside.
- Player: full screen, Video.js controls, resume from saved time, next-episode button for series, back button.
- Responsive: 360 px phone to 1920 px desktop. Skeleton loaders everywhere data loads.
- Respect `prefers-reduced-motion`. Keep the bundle small (lazy-load Player and Modal).

## 8. Player rules

- Video.js with MP4 and HLS only.
- Save progress every 10 seconds per profile (`profileId:mediaId:episode`).
- Show a friendly error if a stream fails, and try the next source.

## 9. Agents

| Agent | Owns | Task |
|---|---|---|
| Lead | app, types | Scaffold project, types, routing, merges |
| UI | ui, pages | Layout, Navbar, Hero, Rows, Grid, Search page |
| DATA | data | Providers in section 5, hooks, caching, error handling |
| PLAYER | details, player | Details Modal, Video.js player, resume |
| PROFILES | profiles | Profile screen, My List, Continue Watching |
| QA | qa | Verify everything below; never fix code, only report |

Order: Lead -> (UI, DATA in parallel) -> (PLAYER, PROFILES) -> QA -> fixes -> QA again.

## 10. QA agent checklist

Use a real browser (Playwright or the built-in browser agent). Test at 360, 768, 1280 px. Save screenshots to `src/qa/screenshots/`. Write the result to `src/qa/REPORT.md` as PASS / FAIL per line with the exact file and reason for each FAIL.

```
[ ] Profile screen appears first; choosing a profile opens Home
[ ] Navbar: transparent at top, solid after scroll; links work
[ ] Hero shows backdrop, title, overview, working Play and More Info
[ ] Rows scroll horizontally; no layout shift while posters load
[ ] Movies and TV Shows pages show a grid; genre filter works
[ ] Search is debounced; empty and no-result states look correct
[ ] Details Modal opens, shows all fields, closes with Esc and outside click
[ ] Series modal lists seasons and episodes
[ ] Player plays an MP4 and an HLS test stream
[ ] Progress is saved and resumes after reload
[ ] My List add/remove persists per profile
[ ] No console errors; no horizontal page scroll at 360 px
[ ] TMDB attribution is visible
[ ] No hardcoded copyrighted stream URLs anywhere (grep the repo)
[ ] Lighthouse performance >= 80 on mobile
```

## 11. Definition of done

- `npm run build` passes with no TypeScript errors.
- QA report has zero FAIL lines.
- `README.md` explains setup, env variables, and how to add a legal library entry.
- `DECISIONS.md` lists every assumption made.
