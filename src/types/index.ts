// Shared types — owned by Lead agent
// All agents import from here. Do not duplicate these definitions.

export type MediaType = 'movie' | 'series';

export interface MediaItem {
  id: string;            // imdb id or tmdb id
  type: MediaType;
  title: string;
  year?: number;
  poster?: string;
  backdrop?: string;
  thumbnail?: string;    // 16:9 landscape thumbnail (Apple-style)
  logo?: string;         // Transparent title logo image/CDN
  subtitle?: string;     // e.g. "Recently Added" or genre badge
  genres?: string[];     // genres for dynamic recommendation matching
  rating?: number;
  streams?: StreamSource[];
  videoPreview?: string; // Optional direct MP4 preview URL
}

export interface MediaDetails extends MediaItem {
  overview: string;
  genres: string[];
  runtime?: number;
  cast: { name: string; character?: string }[];
  seasons?: Season[];
}

export interface Season {
  season: number;
  episodes: Episode[];
}

export interface Episode {
  episode: number;
  title: string;
  overview?: string;
  thumbnail?: string;
}

export interface EpisodeRef {
  season: number;
  episode: number;
}

export interface StreamSource {
  url: string;
  type: 'video/mp4' | 'application/x-mpegURL';
  label: string;
  subtitles?: Subtitle[];
  infoHash?: string;
  fileIdx?: number;
  seeders?: number;
  size?: string;
  resolution?: string;
  filename?: string;
}

export interface Subtitle {
  lang: string;
  url: string;
}

// Content provider interface — all data sources implement this
export interface ContentProvider {
  id: string;
  name: string;
  getCatalog(type: MediaType, catalogId: string, page?: number): Promise<MediaItem[]>;
  search(query: string): Promise<MediaItem[]>;
  getMeta(type: MediaType, id: string): Promise<MediaDetails>;
  getStreams(type: MediaType, id: string, episode?: EpisodeRef): Promise<StreamSource[]>;
}

// Profile types
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
}

// Watchlist / Continue Watching
export interface WatchlistEntry {
  mediaId: string;
  mediaType: MediaType;
  title: string;
  poster?: string;
  backdrop?: string;
  addedAt: number;
}

export interface WatchProgress {
  mediaId: string;
  mediaType: MediaType;
  title: string;
  poster?: string;
  backdrop?: string;
  currentTime: number;
  duration: number;
  episode?: EpisodeRef;
  updatedAt: number;
}

// Catalog definition for home page rows
export interface CatalogDefinition {
  id: string;
  name: string;
  type: MediaType;
}

// Addon manifest (Stremio protocol)
export interface AddonManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  catalogs: {
    type: string;
    id: string;
    name?: string;
  }[];
  resources: string[];
  types: string[];
}
