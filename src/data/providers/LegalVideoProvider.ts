import type {
  ContentProvider,
  MediaType,
  MediaItem,
  MediaDetails,
  StreamSource,
  EpisodeRef,
} from '@/types';
import { cache } from '../cache';

interface LibraryEntry {
  id: string;
  type: MediaType;
  title: string;
  year?: number;
  poster?: string;
  backdrop?: string;
  thumbnail?: string;
  logo?: string;
  subtitle?: string;
  rating?: number;
  overview: string;
  genres: string[];
  runtime?: number;
  cast: { name: string; character?: string }[];
  seasons?: { season: number; episodes: { episode: number; title: string; overview?: string }[] }[];
  streams?: StreamSource[];
}

let libraryCache: LibraryEntry[] | null = null;

async function loadLibrary(): Promise<LibraryEntry[]> {
  if (libraryCache) return libraryCache;

  const cached = cache.get<LibraryEntry[]>('legalvideo:library');
  if (cached) {
    libraryCache = cached;
    return cached;
  }

  try {
    const res = await fetch(`/library.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Library fetch ${res.status}`);
    const data = (await res.json()) as LibraryEntry[];
    libraryCache = data;
    cache.set('legalvideo:library', data);
    return data;
  } catch {
    return [];
  }
}

function toMediaItem(entry: LibraryEntry): MediaItem {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    year: entry.year,
    poster: entry.poster,
    backdrop: entry.backdrop,
    thumbnail: entry.thumbnail || entry.backdrop || entry.poster,
    logo: entry.logo,
    subtitle: entry.subtitle,
    genres: entry.genres || [],
    rating: entry.rating,
    streams: entry.streams,
  };
}

function toMediaDetails(entry: LibraryEntry): MediaDetails {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    year: entry.year,
    poster: entry.poster,
    backdrop: entry.backdrop,
    thumbnail: entry.thumbnail || entry.backdrop || entry.poster,
    logo: entry.logo,
    subtitle: entry.subtitle,
    rating: entry.rating,
    overview: entry.overview,
    genres: entry.genres || [],
    runtime: entry.runtime,
    cast: entry.cast,
    seasons: entry.seasons,
    streams: entry.streams,
  };
}

export class LegalVideoProvider implements ContentProvider {
  id = 'legal-video';
  name = 'Legal Video Library';

  async getCatalog(type: MediaType, _catalogId: string): Promise<MediaItem[]> {
    try {
      const library = await loadLibrary();
      return library
        .filter((e) => e.type === type)
        .map(toMediaItem);
    } catch {
      return [];
    }
  }

  async search(query: string): Promise<MediaItem[]> {
    try {
      if (!query.trim()) return [];
      const library = await loadLibrary();
      const q = query.toLowerCase();
      return library
        .filter((e) => e.title.toLowerCase().includes(q))
        .map(toMediaItem);
    } catch {
      return [];
    }
  }

  async getMeta(_type: MediaType, id: string): Promise<MediaDetails> {
    try {
      const library = await loadLibrary();
      const entry = library.find((e) => e.id === id);
      if (entry) return toMediaDetails(entry);
      return { id, type: 'movie', title: 'Unknown', overview: '', genres: [], cast: [] };
    } catch {
      return { id, type: 'movie', title: 'Unknown', overview: '', genres: [], cast: [] };
    }
  }

  async getStreams(_type: MediaType, id: string, episode?: EpisodeRef): Promise<StreamSource[]> {
    try {
      const library = await loadLibrary();
      const entry = library.find((e) => e.id === id);
      if (!entry) return [];

      if (episode && entry.seasons) {
        const season = entry.seasons.find((s) => s.season === episode.season);
        const ep = season?.episodes.find((e) => e.episode === episode.episode) as
          | { episode: number; title: string; overview?: string; stream?: StreamSource }
          | undefined;

        if (ep?.stream) {
          return [ep.stream];
        }
      }

      return entry.streams ?? [];
    } catch {
      return [];
    }
  }
}
