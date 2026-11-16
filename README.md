# Endless Stream

<p align="center">
  <img src="Assets/endless-stream-icon.svg" width="128" height="128" alt="Endless Stream Logo" />
</p>

<p align="center">
  <strong>Next-Generation Open Streaming Platform with Living Glassmorphism Architecture</strong>
</p>

<p align="center">
  Zero Subscription Cost &bull; Sovereign Stremio Freedom Model &bull; Native BitTorrent P2P Engine &bull; Dual Desktop & Android Runtime
</p>

---

> [!NOTE]
> **Project Status (Paused / Future Roadmap)**  
> As of Release V1.0, active development on Endless Stream is paused for future review. This document serves as the comprehensive architectural blueprint, detailing the implemented frontend, native desktop/mobile engines, data flow pipelines, and technical trade-offs.

---

## 1. System Architecture Overview

Endless Stream is organized into five decoupled layers spanning the presentation layer, sovereign state, protocol dispatch, desktop embedded streaming engine, and the native Android Media3 ExoPlayer bridge.

```mermaid
flowchart TD
    subgraph Presentation["1. Presentation & UI Layer"]
        LivingUI["Apple TV+ Living Glassmorphic UI<br/>(React 18 + Tailwind CSS)"]
        Nav["Living Capsule Navigation<br/>(Top Desktop Centered / Bottom Mobile)"]
        Modals["Details Modal & Addon Manager"]
        PlayerUI["Living Player Controls & HUD<br/>(Scrubber, Audio Tracks, OpenSubtitles)"]
    end

    subgraph State["2. Sovereign State Core"]
        Profiles["ProfileStore (Zustand)<br/>(Avatars, Active User)"]
        Watchlist["WatchlistStore (Zustand)<br/>(Per-Profile My List)"]
        Progress["ProgressStore (Zustand)<br/>(Resume Position, Purge on 90%)"]
        UIState["UIStore (Zustand)<br/>(Modals, Addon Triggers)"]
    end

    subgraph Protocol["3. Protocol & Provider Registry"]
        Registry["Provider Registry (providerRegistry.ts)"]
        Cinemeta["Cinemeta Provider (Metadata/Catalogs)"]
        Addons["AddonProvider (Stremio v3 Manifests)"]
        Proxy["Local Proxy (/addon-proxy, /subtitles-proxy)"]
    end

    subgraph DesktopRuntime["4. Desktop Streaming Runtime (Electron)"]
        Elec["Electron 45 Main Process (main.cjs)"]
        EmbServer["Embedded HTTP Server (127.0.0.1:5173)"]
        P2P["torrent-stream Swarm Engine"]
        FFmpeg["FFmpeg Disk-Buffered Transmuxer"]
        DiskCache["10 GB LRU Cache Management"]
    end

    subgraph AndroidRuntime["5. Android Native Runtime (Capacitor)"]
        Cap["Capacitor Bridge Activity"]
        ExoPlugin["ExoPlayerPlugin.java (Media3)"]
        NativeView["Native PlayerView (Layer 0)"]
        TransWeb["Transparent WebView (Layer 1)"]
        Orientation["ScreenOrientation Plugin (Landscape/Portrait)"]
    end

    LivingUI --> Profiles
    LivingUI --> Watchlist
    LivingUI --> Progress
    LivingUI --> UIState

    LivingUI --> Registry
    Registry --> Cinemeta
    Registry --> Addons
    Addons --> Proxy

    Registry --> DesktopRuntime
    DesktopRuntime --> PlayerUI

    Registry --> AndroidRuntime
    AndroidRuntime --> PlayerUI

    classDef uiStyle fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef stateStyle fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef protoStyle fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef deskStyle fill:#312e81,stroke:#a78bfa,stroke-width:2px,color:#f8fafc;
    classDef andStyle fill:#431407,stroke:#fb923c,stroke-width:2px,color:#f8fafc;

    class LivingUI,Nav,Modals,PlayerUI uiStyle;
    class Profiles,Watchlist,Progress,UIState stateStyle;
    class Registry,Cinemeta,Addons,Proxy protoStyle;
    class Elec,EmbServer,P2P,FFmpeg,DiskCache deskStyle;
    class Cap,ExoPlugin,NativeView,TransWeb,Orientation andStyle;
```

---

## 2. The Stremio Sovereign Freedom Model

Following the Stremio architectural paradigm, Endless Stream strictly separates client software from content indexes:

1. **Zero Pre-bundled Scrapers**: Out of the box, the client bundles zero scrapers, torrent aggregators, or private indexes.
2. **Standard Stremio v3 Protocol**: The application speaks the open Stremio JSON protocol (`/manifest.json`, `/catalog/...`, `/meta/...`, `/stream/...`, `/subtitles/...`).
3. **User-Controlled Extensions**: Users configure add-ons via the visual Addon Manager. All manifests are persisted locally in `localStorage` under `endless_stream:addon_urls`.
4. **Zero-Addon Baseline**: Users retain full capability to purge all installed add-ons back to zero at any time.

```mermaid
flowchart LR
    User["User"]
    AddonModal["Addon Manager Modal"]
    LocalStore["localStorage<br/>(endless_stream:addon_urls)"]
    Registry["ProviderRegistry"]
    Manifest["Community Manifest URL<br/>(manifest.json)"]
    Streams["Stream Resolution Pipeline"]

    User -->|Paste URL or Install| AddonModal
    AddonModal -->|Validate Manifest| Manifest
    Manifest -->|Save Valid URL| LocalStore
    LocalStore -->|Hydrate| Registry
    Registry -->|Query Streams| Streams

    classDef defaultStyle fill:#18181b,stroke:#a1a1aa,stroke-width:1px,color:#f4f4f5;
    classDef accentStyle fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#f8fafc;
    classDef greenStyle fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f8fafc;

    class User,AddonModal defaultStyle;
    class LocalStore,Registry accentStyle;
    class Manifest,Streams greenStyle;
```

---

## 3. Desktop Streaming Engine (Electron & P2P)

On Windows Desktop, Endless Stream operates an embedded loopback server with an integrated BitTorrent client and on-the-fly media transmuxer.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Player as React VideoPlayer
    participant Server as Embedded HTTP Server (5173)
    participant Engine as P2P Middleware (torrent-stream)
    participant Disk as Temp Cache Disk
    participant FFmpeg as FFmpeg Process
    participant Video as HTML5 Video Element

    User->>Player: Click Stream (infoHash, fileIdx)
    Player->>Server: GET /stream/:infoHash/:fileIdx
    Server->>Engine: getOrCreateEngine(infoHash)
    Engine->>Engine: Connect Trackers & DHT Swarm
    Engine->>Engine: Prioritize Head (8 pcs) & Tail (2 pcs)
    Engine->>Disk: Write Incoming Chunks to Disk
    
    alt Stream is Native MP4 / WebM
        Server->>Video: HTTP 206 Partial Content (Range Stream)
    else Stream is Matroska (.mkv) / Other
        Engine->>Engine: waitForHeadChunks(fileToStream)
        Server->>FFmpeg: Spawn FFmpeg (-i fullFilePath -c:v copy -f mp4)
        FFmpeg-->>Server: Stream Fragmented MP4 stdout
        Server-->>Video: Pipe MP4 to HTML5 Video Element
    end

    Video->>Player: onLoadedMetadata / onCanPlay
    Player->>Player: Dismiss Prebuffering Modal & Play
```

### Key Technical Properties:
- **Disk-Buffered Remuxing**: Reading directly from disk (`-i fullFilePath` with `-probesize 1M -analyzeduration 1M -fflags +nobuffer+fastseek`) eliminates stream starvation associated with unseekable pipes.
- **HTTP 206 Range Streaming**: For MP4 files, Range requests (`bytes=start-end`) enable instantaneous seeking without invoking FFmpeg.
- **10 GB LRU Cache**: Background cleaner tracks file access timestamps and automatically purges inactive chunks when disk consumption exceeds 10 GB.

---

## 4. Android Native Architecture (Media3 ExoPlayer)

On Android, Endless Stream compiles into a native APK using Capacitor, leveraging Google's **Media3 ExoPlayer** for hardware-accelerated video rendering.

```mermaid
flowchart TD
    subgraph DeviceWindow["Android Device Window Frame"]
        subgraph Layer0["Layer 0: Native Video Surface"]
            PlayerView["androidx.media3.ui.PlayerView<br/>(Hardware Accelerated Video Surface)"]
            ExoInstance["androidx.media3.exoplayer.ExoPlayer<br/>(H.264 / H.265 / VP9 / AV1 / AC3 / DTS)"]
        end

        subgraph Layer1["Layer 1: Transparent WebView"]
            CapBridge["Capacitor Bridge"]
            DOM["DOM Body (background: transparent)<br/>(Living React Controls Floating on Top)"]
            ReactUI["Living Player Controls<br/>(Scrub Bar, 3-Dot Menu, Audio/Subtitle Selector)"]
        end
    end

    ExoInstance --> PlayerView
    CapBridge --> TransBridge["exoPlayerBridge.ts"]
    TransBridge <--> ExoPlugin["ExoPlayerPlugin.java"]
    ExoPlugin --> ExoInstance
    ReactUI --> DOM

    classDef l0Style fill:#022c22,stroke:#059669,stroke-width:2px,color:#ecfdf5;
    classDef l1Style fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#e0e7ff;
    classDef devStyle fill:#09090b,stroke:#27272a,stroke-width:2px,color:#fafafa;

    class Layer0 l0Style;
    class Layer1 l1Style;
    class DeviceWindow devStyle;
```

### Android Enhancements in V1.0:
1. **Cleartext Traffic Support**: `android:usesCleartextTraffic="true"` configured in `AndroidManifest.xml` to allow HTTP/P2P local streaming endpoints.
2. **Transparent WebView Stacking**: Dynamic toggling of `document.body` and `document.documentElement` background colors to `transparent` during playback, allowing the native `PlayerView` beneath the WebView to remain visible.
3. **Network DataSource Configuration**: `DefaultHttpDataSource.Factory` configured with `allowCrossProtocolRedirects(true)` and standardized mobile User-Agent.
4. **Orientation Lock**: Dynamic toggling between portrait and landscape modes using `@capacitor/screen-orientation`.
5. **Locked JDK 17 Toolchain**: `android/gradle.properties` locks the Gradle daemon JVM to Amazon Corretto JDK 17 to prevent Java 25 class file semantic analysis incompatibilities.

---

## 5. Repository File Structure

```
ProjectX/
├── android/                         # Native Android Capacitor Project
│   ├── app/
│   │   ├── build.gradle             # Android app build configuration (Media3 dependencies)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml  # Cleartext HTTP & permissions
│   │       └── java/com/endless/stream/
│   │           ├── MainActivity.java     # BridgeActivity with 60+ FPS display refresh
│   │           └── ExoPlayerPlugin.java  # Native Media3 ExoPlayer bridge
│   ├── build_apk.bat                # Automated Android APK compilation script
│   └── gradle.properties            # JDK 17 daemon lock
├── electron/
│   ├── main.cjs                     # Electron main process & embedded server
│   └── preload.cjs                  # Secure context isolation bridge
├── server/
│   ├── p2pMiddleware.js             # BitTorrent swarm engine & FFmpeg transmuxer
│   └── streamServer.js              # Standalone streaming server wrapper
├── src/
│   ├── app/                         # Application root, routing, UI stores
│   ├── data/                        # Content providers, hooks, cache, Stremio addon registry
│   ├── details/                     # Content details modal & episode picker
│   ├── pages/                       # Home, Movies, TV Shows, Search, My List
│   ├── player/                      # VideoPlayer, LoomBoxLoading, ExoPlayer bridge
│   ├── profiles/                    # Multi-profile system, watchlist & progress stores
│   └── ui/                          # Apple TV+ glassmorphism components (Navbar, Hero, Row, PosterCard)
├── package_desktop.cjs              # Electron standalone packager script
└── vite.config.ts                   # Vite configuration with Tailwind CSS v4
```

---

## 6. Build Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **JDK**: Amazon Corretto JDK 17 (Required for Android builds)
- **Git**: Installed on PATH

### Development Server
```bash
npm install
npm run dev
```

### Building Windows Desktop Standalone (.exe)
```bash
node package_desktop.cjs
```
Output: `release-builds/Endless Stream-win32-x64/Endless Stream.exe`

### Building Android APK (.apk)
```bash
npm run build
npx cap sync android
cmd /c "build_apk.bat"
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 7. Known Technical Limitations & Future Work

1. **Torrent Swarm Cold Starts**: Swarms with low seed counts take time to gather initial pieces. A persistent distributed metadata cache or web-seed integration would accelerate startup times.
2. **Real-time Remuxing on Unfinished Files**: Incomplete MKV containers require robust cue probing to prevent FFmpeg pipeline stalls when seeking into unbuffered piece boundaries.
3. **Android Background Torrent Daemon**: Native Android playback functions best with direct HTTP/Debrid streams. Full standalone BitTorrent streaming on mobile would benefit from an embedded native C++ libtorrent daemon.

---

## 8. License

Distributed under the MIT License. Endless Stream does not host, provide, or scrape copyrighted media streams. All catalogs and streams are managed through third-party community add-ons under user sovereignty.
