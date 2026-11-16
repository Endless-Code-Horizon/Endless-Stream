# Endless Stream

<p align="center">
  <img src="Assets/endless-stream-icon.svg" width="112" height="112" alt="Endless Stream Logo" />
</p>

<p align="center">
  <strong>Apple TV+ Glassmorphism UI/UX Showcase Shell</strong><br/>
  An open-source, cinematic streaming interface shell inspired by Stremio's modular architecture.
</p>

---

## 1. Overview

**Endless Stream** is a frontend UI/UX showcase shell engineered with React 19, Tailwind CSS v4, and Zustand. It demonstrates an Apple TV+ aesthetic featuring fluid glassmorphism, dynamic backdrop lighting, living capsule navigation, personalized multi-profile avatars, and modular add-on management.

In showcase mode, the client functions exclusively as an ethical metadata browser connected to public **Cinemeta** endpoints (`v3-cinemeta.strem.io`). All video playback engines, P2P torrent streaming modules, and native platform wrappers have been safely archived under `_hold/` to preserve a clean, legal web-only footprint.

---

## 2. System Architecture

```
+-------------------------------------------------------------------------+
|                       Active Web Frontend (React 19)                    |
|                                                                         |
|  +--------------------+   +---------------------+   +----------------+  |
|  |  Living Navigation |   |  Hero Carousel      |   | Catalog Rows   |  |
|  |  (Capsule Navbar)  |   |  (Glass Backdrop)   |   | (Posters/Tags) |  |
|  +--------------------+   +---------------------+   +----------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                    Details Modal & Add-on Manager                 |  |
|  |            (Cinemeta Metadata & Read-Only Showcase)               |  |
|  +-------------------------------------------------------------------+  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                  Content & Metadata Layer (Data Core)                   |
|                                                                         |
|  +--------------------------------+   +------------------------------+  |
|  |        Provider Registry       |   |       Cinemeta API           |  |
|  |   (providerRegistry.ts)        |<->|   (v3-cinemeta.strem.io)     |  |
|  |  * Showcase Mode: Cinemeta     |   |   * Movies, Shows, Seasons   |  |
|  +--------------------------------+   +------------------------------+  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                 Sovereign Local State (Browser Storage)                 |
|                                                                         |
|  +--------------------------------+   +------------------------------+  |
|  |       User Profiles Store      |   |       Watchlist Store        |  |
|  |     (Avatars, Active User)     |   |     (Per-Profile My List)    |  |
|  +--------------------------------+   +------------------------------+  |
+------------------------------------+------------------------------------+
                                     :
             [ Inactive / Archived Code for Contributors ]
                                     :
+------------------------------------+------------------------------------+
|                         _hold/ Archive Folder                           |
|                                                                         |
|  - _hold/player/   : Video.js, LoomBox loader & native bridge           |
|  - _hold/server/   : Node.js BitTorrent streaming server & FFmpeg remux |
|  - _hold/electron/ : Electron 45 desktop shell & window orchestration   |
|  - _hold/android/  : Capacitor Android project with Media3 ExoPlayer    |
|  - _hold/scripts/  : Standalone packaging and build scripts             |
+-------------------------------------------------------------------------+
```

---

## 3. Legal & Ethical Disclaimer

- **Zero Copyrighted Media**: Endless Stream does not host, store, index, or distribute any media files, video streams, or copyrighted material.
- **Zero Built-In Scrapers or Torrents**: The active web shell includes zero scrapers, torrent swarm engines, or private indexers.
- **Public Metadata Only**: Catalogs, synopses, episode guides, and poster artwork are sourced strictly from open, public metadata protocols (Cinemeta).
- **Playback Disabled in Showcase**: Video playback navigation is disabled across all UI components, serving as an interactive demonstration of modern streaming UI design patterns.

---

## 4. Key UI/UX Highlights

- **Living Creature Navigation**: Floating capsule navbar with top-centered alignment on desktop and bottom ergonomics on mobile.
- **Cinematic Apple TV+ Backdrop Glow**: Dynamic ambient backlighting adapting to poster tones.
- **Detailed Episode & Title Inspector**: High-resolution metadata badges (HD, CC, TV-MA, IMDb ratings), full synopses, cast lists, and season pickers.
- **Multi-Profile System**: Living avatar profiles with independent watchlists stored entirely in client `localStorage`.
- **Modular Add-on Manager**: Stremio-inspired protocol manager demonstrating extensible content discovery.

---

## 5. Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- npm v9.0.0 or higher

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/narayan-sigmamale/Endless-Stream.git
cd Endless-Stream

# Install frontend dependencies
npm install

# Start Vite local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Linting & Production Build
```bash
# Run oxlint for code quality
npm run lint

# Compile TypeScript and create production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## 6. Project Structure

```
ProjectX/
├── _hold/                           # Archived modules (Playback, Server, Electron, Android)
│   ├── android/                     # Capacitor Media3 ExoPlayer Android project
│   ├── electron/                    # Electron main & preload scripts
│   ├── player/                      # Video player components & bridges
│   ├── scripts/                     # Native build and packaging scripts
│   └── server/                      # P2P stream server & middleware
├── public/                          # Static web assets & icons
├── src/
│   ├── addons/                      # Add-on Manager modal & preset definitions
│   ├── app/                         # App shell, router layout, and UI state store
│   ├── data/                        # Cinemeta provider, query hooks, and cache
│   ├── details/                     # Glassmorphic Details Modal & episode picker
│   ├── pages/                       # Home, Movies, Shows, Search, My List
│   ├── profiles/                    # Multi-profile system, avatars & watchlist
│   ├── types/                       # TypeScript interfaces and data models
│   └── ui/                          # Glassmorphic UI components (Navbar, Hero, Row)
├── package.json                     # Frontend dependencies and scripts
├── tsconfig.json                    # TypeScript compiler configuration (excludes _hold)
└── vite.config.ts                   # Vite bundler configuration with Tailwind CSS v4
```

---

## 7. License

Distributed under the [MIT License](LICENSE).
