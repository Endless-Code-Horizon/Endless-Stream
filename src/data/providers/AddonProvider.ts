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

  async getStreams(type: MediaType, id: string, episode?: EpisodeRef): Promise<StreamSource[]> {
    if (!id || !id.trim()) return [];
    try {
      await this.loadManifest();
      if (!this.supportsResource('stream', type, id)) return [];

      const addonType = type === 'series' ? 'series' : 'movie';
      // For series, standard Stremio format is {id}:{season}:{episode}
      const streamId =
        addonType === 'series' && episode
          ? `${id}:${episode.season}:${episode.episode}`
          : id;

      const cacheKey = `addon:${this.url}:stream:${addonType}:${streamId}`;
      const cached = cache.get<StreamSource[]>(cacheKey);
      if (cached) return cached;

      const res = await fetchWithFallback(`${this.url}/stream/${addonType}/${streamId}.json`);
      if (!res.ok) return [];

      interface StremioStream {
        url?: string;
        infoHash?: string;
        fileIdx?: number;
        title?: string;
        name?: string;
        description?: string;
        ytId?: string;
        subtitles?: { id?: string; url: string; lang: string }[];
        behaviorHints?: {
          filename?: string;
          bingeGroup?: string;
          notWebReady?: boolean;
        };
      }

      const data = (await res.json()) as { streams?: StremioStream[] };
      const rawStreams = data.streams ?? [];

      const cleanLabel = (s: StremioStream, isP2P = false): string => {
        const name = s.name ? s.name.replace(/\r?\n+/g, ' · ').trim() : '';
        const title = s.title ? s.title.replace(/\r?\n+/g, ' · ').trim() : '';
        const desc = s.description ? s.description.replace(/\r?\n+/g, ' · ').trim() : '';
        const text = [name, title, desc].filter(Boolean).join(' - ') || (isP2P ? `Torrent (${s.infoHash?.slice(0, 8)})` : 'Direct Stream');
        return isP2P ? `[P2P] ${text}` : text;
      };

      const scoreStream = (s: StremioStream): number => {
        const raw = `${s.name || ''} ${s.title || ''} ${s.description || ''} ${s.behaviorHints?.filename || ''}`.toLowerCase();
        
        let seeders = 0;
        const mSeeds = raw.match(/[👤👥]\s*(\d+)/) || raw.match(/seeds?:\s*(\d+)/);
        if (mSeeds) seeders = parseInt(mSeeds[1], 10);

        const isHEVC = raw.includes('hevc') || raw.includes('h265') || raw.includes('x265') || raw.includes('dv') || raw.includes('hdr10+');
        const isH264 = raw.includes('h264') || raw.includes('x264') || raw.includes('avc') || (!isHEVC && raw.includes('.mp4'));
        const is1080p = raw.includes('1080p') || raw.includes('fhd');
        const is720p = raw.includes('720p') || raw.includes('hd');
        const isMP4 = (s.behaviorHints?.filename || '').toLowerCase().endsWith('.mp4') || raw.includes('.mp4');

        let score = 0;
        // Direct HTTPS streams (like Debrid or HTTP links) are highest priority
        if (s.url && !s.url.startsWith('magnet:')) score += 1000;
        // 1080p / 720p H.264 MP4 streams play natively in browsers with 0 transcoding and 0 errors
        if (isH264) score += 400;
        if (isMP4) score += 150;
        if (is1080p) score += 300;
        else if (is720p) score += 200;
        // Seeders count (more seeders = faster instant streaming)
        score += Math.min(seeders, 300);
        // Penalize 70GB 4K HEVC Remuxes for default web browser playback
        if (isHEVC) score -= 250;

        return score;
      };

      // Sort streams so instant browser-playable streams appear first
      const sortedStreams = [...rawStreams].sort((a, b) => scoreStream(b) - scoreStream(a));

      const streams: StreamSource[] = [];

      for (const s of sortedStreams.slice(0, 50)) {
        const rawMeta = `${s.name || ''} ${s.title || ''} ${s.description || ''} ${s.behaviorHints?.filename || ''}`;
        let seeders: number | undefined = undefined;
        const mSeeds = rawMeta.match(/[👤👥]\s*(\d+)/) || rawMeta.match(/seeds?:\s*(\d+)/i);
        if (mSeeds) seeders = parseInt(mSeeds[1], 10);

        let size: string | undefined = undefined;
        const mSize = rawMeta.match(/[💾]\s*([\d.]+\s*(?:GB|MB|TB))/i) || rawMeta.match(/([\d.]+\s*(?:GB|MB))\b/i);
        if (mSize) size = mSize[1].trim();

        const subs = s.subtitles?.map((sub) => ({
          lang: sub.lang || 'English',
          url: sub.url,
        }));

        // Case A: infoHash provided directly in stream
        let infoHash = s.infoHash ? s.infoHash.toLowerCase().trim() : undefined;

        // Case B: URL is a magnet URI (e.g. Anime Kitsu or Torrent addons)
        if (!infoHash && s.url && s.url.startsWith('magnet:')) {
          const match = s.url.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
          if (match) {
            infoHash = match[1].toLowerCase();
          }
        }

        if (infoHash) {
          const fileIndex = typeof s.fileIdx === 'number' ? s.fileIdx : 0;
          const p2pStreamUrl = `/stream/${infoHash}/${fileIndex}`;

          streams.push({
            url: p2pStreamUrl,
            type: 'video/mp4',
            label: cleanLabel(s, true),
            infoHash,
            fileIdx: fileIndex,
            filename: s.behaviorHints?.filename,
            seeders,
            size,
            subtitles: subs,
          });
        } else if (s.url) {
          streams.push({
            url: s.url,
            type: s.url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
            label: cleanLabel(s, false),
            filename: s.behaviorHints?.filename,
            seeders,
            size,
            subtitles: subs,
          });
        } else if (s.ytId) {
          streams.push({
            url: `https://www.youtube.com/watch?v=${s.ytId}`,
            type: 'video/mp4',
            label: cleanLabel(s, false) || 'YouTube Stream',
            filename: s.behaviorHints?.filename,
            seeders,
            size,
            subtitles: subs,
          });
        }
      }

      cache.set(cacheKey, streams);
      return streams;
    } catch {
      return [];
    }
  }
}
