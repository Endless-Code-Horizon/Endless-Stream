import type {
  ContentProvider,
  MediaType,
  MediaItem,
  MediaDetails,
  StreamSource,
  EpisodeRef,
} from '@/types';
import { cache } from '../cache';

const API_BASE = 'https://api.themoviedb.org/3';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

function apiKey(): string {
  return import.meta.env.VITE_TMDB_KEY ?? '';
}

function tmdbUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('api_key', apiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapItem(item: any): MediaItem | null {
  const mediaType: MediaType | null =
    item.media_type === 'movie' || item.title
      ? 'movie'
      : item.media_type === 'tv' || item.name
        ? 'series'
        : null;
  if (!mediaType) return null;

  const title = item.title ?? item.name ?? 'Unknown';
  const dateStr = item.release_date ?? item.first_air_date ?? '';
  const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : undefined;

  return {
    id: String(item.id),
    type: mediaType,
    title,
    year: Number.isNaN(year) ? undefined : year,
    poster: item.poster_path ? `${POSTER_BASE}${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `${BACKDROP_BASE}${item.backdrop_path}` : undefined,
    rating: item.vote_average ?? undefined,
  };
}

function mapDetails(item: any, type: MediaType): MediaDetails {
  const title = item.title ?? item.name ?? 'Unknown';
  const dateStr = item.release_date ?? item.first_air_date ?? '';
  const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : undefined;
  const credits = item.credits ?? {};
  const cast = (credits.cast ?? []).slice(0, 15).map((c: any) => ({
    name: c.name as string,
    character: (c.character as string | undefined) ?? undefined,
  }));
  const genres = (item.genres ?? []).map((g: any) => g.name as string);
  const seasons = (item.seasons ?? []).map((s: any) => ({
    season: s.season_number as number,
    episodes: [] as { episode: number; title: string; overview?: string }[],
  }));

  return {
    id: String(item.id),
    type,
    title,
    year: Number.isNaN(year) ? undefined : year,
    poster: item.poster_path ? `${POSTER_BASE}${item.poster_path}` : undefined,
    backdrop: item.backdrop_path ? `${BACKDROP_BASE}${item.backdrop_path}` : undefined,
    rating: item.vote_average ?? undefined,
    overview: item.overview ?? '',
    genres,
    runtime: item.runtime ?? item.episode_run_time?.[0] ?? undefined,
    cast,
    seasons: seasons.length > 0 ? seasons : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json() as Promise<unknown>;
}

export class TmdbProvider implements ContentProvider {
  id = 'tmdb';
  name = 'TMDB';

  async getCatalog(type: MediaType, catalogId: string, page: number = 1): Promise<MediaItem[]> {
    try {
      const cacheKey = `tmdb:catalog:${type}:${catalogId}:${page}`;
      const cached = cache.get<MediaItem[]>(cacheKey);
      if (cached) return cached;

      let path: string;
      if (catalogId === 'trending') {
        path = '/trending/all/week';
      } else {
        const prefix = type === 'movie' ? 'movie' : 'tv';
        path = `/${prefix}/${catalogId}`;
      }

      const data = await fetchJson(tmdbUrl(path, { page: String(page) })) as { results?: unknown[] };
      const results = (data.results ?? [])
        .map(mapItem)
        .filter((x): x is MediaItem => x !== null);

      cache.set(cacheKey, results);
      return results;
    } catch {
      return [];
    }
  }

  async search(query: string): Promise<MediaItem[]> {
    try {
      if (!query.trim()) return [];
      const cacheKey = `tmdb:search:${query}`;
      const cached = cache.get<MediaItem[]>(cacheKey);
      if (cached) return cached;

      const data = await fetchJson(tmdbUrl('/search/multi', { query })) as { results?: unknown[] };
      const results = (data.results ?? [])
        .map(mapItem)
        .filter((x): x is MediaItem => x !== null);

      cache.set(cacheKey, results);
      return results;
    } catch {
      return [];
    }
  }

  async getMeta(type: MediaType, id: string): Promise<MediaDetails> {
    try {
      const cacheKey = `tmdb:meta:${type}:${id}`;
      const cached = cache.get<MediaDetails>(cacheKey);
      if (cached) return cached;

      const prefix = type === 'movie' ? 'movie' : 'tv';
      const data = await fetchJson(tmdbUrl(`/${prefix}/${id}`, { append_to_response: 'credits' }));
      const details = mapDetails(data, type);

      cache.set(cacheKey, details);
      return details;
    } catch {
      return {
        id,
        type,
        title: 'Unknown',
        overview: '',
        genres: [],
        cast: [],
      };
    }
  }

  async getStreams(_type: MediaType, _id: string, _episode?: EpisodeRef): Promise<StreamSource[]> {
    return [];
  }
}
