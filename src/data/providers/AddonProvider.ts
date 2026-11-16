import type {
  ContentProvider,
  MediaType,
  MediaItem,
  MediaDetails,
  StreamSource,
  EpisodeRef,
  AddonManifest,
  Season,
  Episode,
} from '@/types';
import { cache } from '../cache';

/* eslint-disable @typescript-eslint/no-explicit-any */

function normalizeUrl(url: string): string {
  let clean = url.trim();
  if (clean.startsWith('stremio://')) {
    clean = 'https://' + clean.slice('stremio://'.length);
  }
  // Strip trailing manifest.json or slashes
  clean = clean.replace(/\/manifest\.json$/i, '');
  clean = clean.replace(/\/+$/, '');
  return clean;
}

/**
 * Universal fetch that tries direct fetch first, and falls back to our local
 * /addon-proxy if CORS or network blocks direct access from browser.
 */
async function fetchWithFallback(targetUrl: string): Promise<Response> {
  try {
    const res = await fetch(targetUrl);
    if (res.ok) return res;
    // On 403/401/404, also attempt via proxy in case of Origin headers blockage
    const proxyUrl = `/addon-proxy?url=${encodeURIComponent(targetUrl)}`;
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) return proxyRes;
    return res;
  } catch {
    // Network / CORS block in browser -> route through local addon proxy
    const proxyUrl = `/addon-proxy?url=${encodeURIComponent(targetUrl)}`;
    return fetch(proxyUrl);
  }
}

function mapAddonItem(item: any, type: MediaType): MediaItem | null {
  if (!item || !item.id) return null;
  const poster = item.poster || undefined;
  const backdrop = item.background || undefined;
  const logo = item.logo || undefined;
  const year = item.releaseInfo
    ? parseInt(String(item.releaseInfo).slice(0, 4), 10)
    : item.year
      ? parseInt(String(item.year), 10)
      : undefined;

  return {
    id: String(item.id),
    type,
    title: item.name ?? item.title ?? 'Unknown',
    year: isNaN(year!) ? undefined : year,
    poster,
    backdrop,
    thumbnail: backdrop || poster,
    logo,
    subtitle: item.genres && item.genres.length > 0 ? item.genres[0] : undefined,
    genres: Array.isArray(item.genres) ? item.genres : [],
    rating: item.imdbRating ? parseFloat(item.imdbRating) : undefined,
  };
}

function mapAddonDetails(meta: any, type: MediaType): MediaDetails {
  const poster = meta.poster || undefined;
  const backdrop = meta.background || undefined;
  const logo = meta.logo || undefined;
  const year = meta.releaseInfo
    ? parseInt(String(meta.releaseInfo).slice(0, 4), 10)
    : meta.year
      ? parseInt(String(meta.year), 10)
      : undefined;

  // Group videos into seasons if TV Series
  let seasons: Season[] | undefined = undefined;
  if (type === 'series' && Array.isArray(meta.videos) && meta.videos.length > 0) {
    const seasonsMap = new Map<number, Episode[]>();
    for (const v of meta.videos) {
      const sNum = typeof v.season === 'number' ? v.season : 1;
      const epNum = typeof v.episode === 'number' ? v.episode : (typeof v.number === 'number' ? v.number : 1);
      if (!seasonsMap.has(sNum)) {
        seasonsMap.set(sNum, []);
      }
      seasonsMap.get(sNum)!.push({
        episode: epNum,
        title: v.name || v.title || `Episode ${epNum}`,
        overview: v.overview || v.description || '',
        thumbnail: v.thumbnail || undefined,
      });
    }

    // Sort seasons and episodes
    seasons = Array.from(seasonsMap.entries())
      .filter(([sNum]) => sNum > 0) // Skip season 0 specials by default
      .sort(([a], [b]) => a - b)
      .map(([season, episodes]) => ({
        season,
        episodes: episodes.sort((a, b) => a.episode - b.episode),
      }));

    if (seasons.length === 0 && seasonsMap.has(0)) {
      seasons = [{ season: 0, episodes: seasonsMap.get(0)! }];
    }
  }

  return {
    id: String(meta.id),
    type,
    title: meta.name ?? meta.title ?? 'Unknown',
    year: isNaN(year!) ? undefined : year,
    poster,
    backdrop,
    thumbnail: backdrop || poster,
    logo,
    subtitle: meta.genres && meta.genres.length > 0 ? meta.genres.slice(0, 2).join(' · ') : undefined,
    rating: meta.imdbRating ? parseFloat(meta.imdbRating) : undefined,
    overview: meta.description ?? meta.overview ?? '',
    genres: Array.isArray(meta.genres) ? meta.genres : [],
    runtime: meta.runtime ? parseInt(String(meta.runtime).replace(/[^\d]/g, ''), 10) : undefined,
    cast: Array.isArray(meta.cast)
      ? meta.cast.map((c: any) => ({ name: typeof c === 'string' ? c : c.name || '' }))
      : [],
    seasons,
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export class AddonProvider implements ContentProvider {
  id: string;
  name: string;
  url: string;
  private manifest: AddonManifest | null = null;

  constructor(url: string) {
    this.url = normalizeUrl(url);
    this.id = `addon:${this.url}`;
    this.name = this.url.replace(/^https?:\/\//, '').split('/')[0];
  }

  async loadManifest(): Promise<AddonManifest | null> {
    if (this.manifest) return this.manifest;
    try {
      const cacheKey = `addon:manifest:${this.url}`;
      const cached = cache.get<AddonManifest>(cacheKey);
      if (cached) {
        this.manifest = cached;
        this.name = cached.name || this.name;
        return cached;
      }

      const res = await fetchWithFallback(`${this.url}/manifest.json`);
      if (!res.ok) return null;
      const data = (await res.json()) as AddonManifest;
      this.manifest = data;
      this.name = data.name || this.name;
      cache.set(cacheKey, data);
      return data;
    } catch {
      return null;
    }
  }

  supportsResource(resource: string, type?: MediaType, id?: string): boolean {
    if (!this.manifest || !this.manifest.resources) return true;
    return this.manifest.resources.some((r: any) => {
      if (typeof r === 'string') return r === resource;
      if (r && typeof r === 'object' && r.name === resource) {
        if (type && Array.isArray(r.types) && r.types.length > 0) {
          const checkTypes = type === 'series' ? ['series', 'tv'] : ['movie'];
          const hasType = r.types.some((t: string) => {
            const low = t.toLowerCase();
            return checkTypes.includes(low) || low === 'all' || low === 'anime';
          });
          if (!hasType) return false;
        }
        if (id && Array.isArray(r.idPrefixes) && r.idPrefixes.length > 0) {
          const hasPrefix = r.idPrefixes.some((p: string) => id.startsWith(p));
          if (!hasPrefix) return false;
        }
        return true;
      }
      return false;
    });
  }

  async getCatalog(type: MediaType, catalogId: string, _page?: number): Promise<MediaItem[]> {
    if (!catalogId) return [];
    try {
      await this.loadManifest();
      if (!this.supportsResource('catalog', type)) return [];

      const addonType = type === 'series' ? 'series' : 'movie';
      let targetCatalogId = catalogId;

      // Smart catalog matching: match ID in manifest, or pick first catalog of matching type
      if (this.manifest?.catalogs && this.manifest.catalogs.length > 0) {
        const exactMatch = this.manifest.catalogs.find(
          (c) => c.type === addonType && c.id === catalogId
        );
        if (exactMatch) {
          targetCatalogId = exactMatch.id;
        } else {
          const typeMatch = this.manifest.catalogs.find((c) => c.type === addonType);
          if (typeMatch) targetCatalogId = typeMatch.id;
        }
      }

      const cacheKey = `addon:${this.url}:catalog:${addonType}:${targetCatalogId}`;
      const cached = cache.get<MediaItem[]>(cacheKey);
      if (cached) return cached;

      const res = await fetchWithFallback(`${this.url}/catalog/${addonType}/${targetCatalogId}.json`);
      if (!res.ok) return [];
      const data = (await res.json()) as { metas?: unknown[] };
      const results = (data.metas ?? [])
        .map((item) => mapAddonItem(item, type))
        .filter((x): x is MediaItem => x !== null);

      cache.set(cacheKey, results);
      return results;
    } catch {
      return [];
    }
  }

  async search(query: string): Promise<MediaItem[]> {
    if (!query.trim()) return [];
    try {
      await this.loadManifest();
      if (!this.supportsResource('catalog')) return [];
      const results: MediaItem[] = [];

      // Query both movie and series catalogs with search parameter
      for (const mediaType of ['movie', 'series'] as MediaType[]) {
        const addonType = mediaType === 'series' ? 'series' : 'movie';
        let catalogId = 'top';
        if (this.manifest && this.manifest.catalogs) {
          const match = this.manifest.catalogs.find((c) => c.type === addonType);
          if (match) catalogId = match.id;
        }

        const cacheKey = `addon:${this.url}:search:${addonType}:${catalogId}:${query}`;
        const cached = cache.get<MediaItem[]>(cacheKey);
        if (cached) {
          results.push(...cached);
          continue;
        }

        const searchUrl = `${this.url}/catalog/${addonType}/${catalogId}/search=${encodeURIComponent(query)}.json`;
        const res = await fetchWithFallback(searchUrl);
        if (res.ok) {
          const data = (await res.json()) as { metas?: unknown[] };
          const items = (data.metas ?? [])
            .map((item) => mapAddonItem(item, mediaType))
            .filter((x): x is MediaItem => x !== null);
          cache.set(cacheKey, items);
          results.push(...items);
        }
      }

      return results;
    } catch {
      return [];
    }
  }

  async getMeta(type: MediaType, id: string): Promise<MediaDetails> {
    if (!id || !id.trim()) {
      return { id: id || '', type, title: 'Unknown', overview: '', genres: [], cast: [] };
    }
    try {
      await this.loadManifest();
      if (!this.supportsResource('meta', type, id)) {
        return { id, type, title: 'Unknown', overview: '', genres: [], cast: [] };
      }

      const addonType = type === 'series' ? 'series' : 'movie';
      const cacheKey = `addon:${this.url}:meta:${addonType}:${id}`;
      const cached = cache.get<MediaDetails>(cacheKey);
      if (cached) return cached;

      const res = await fetchWithFallback(`${this.url}/meta/${addonType}/${id}.json`);
      if (!res.ok) {
        return { id, type, title: 'Unknown', overview: '', genres: [], cast: [] };
      }
      const data = (await res.json()) as { meta?: unknown };
      if (!data.meta) {
        return { id, type, title: 'Unknown', overview: '', genres: [], cast: [] };
      }
      const details = mapAddonDetails(data.meta, type);
      cache.set(cacheKey, details);
      return details;
    } catch {
      return { id, type, title: 'Unknown', overview: '', genres: [], cast: [] };
    }
  }

  async getStreams(_type: MediaType, _id: string, _episode?: EpisodeRef): Promise<StreamSource[]> {
    // Showcase mode: Playback and stream scraping are disabled
    return [];
  }
}
