import type { ContentProvider } from '@/types';
import { TmdbProvider } from './providers/TmdbProvider';
import { AddonProvider } from './providers/AddonProvider';

const ADDON_STORAGE_KEY = 'endless_stream:addon_urls';

// Default official ethical and legal addons enabled out of the box (Free open metadata & subtitles)
// Stream and scrape addons are never pre-bundled; users have complete freedom to install community addons via the Addon Manager.
export const DEFAULT_ADDON_URLS = [
  'https://v3-cinemeta.strem.io', // Official Cinemeta (Movies & TV Shows catalogs, metadata & search)
  'https://opensubtitles-v3.strem.io', // Official OpenSubtitles v3 (Subtitles)
  'https://watchhub.strem.io', // Official WatchHub (Legal streaming availability)
];

const providers: ContentProvider[] = [];

function registerProvider(provider: ContentProvider): void {
  if (!providers.find((p) => p.id === provider.id)) {
    providers.push(provider);
  }
}

export function getSavedAddonUrls(): string[] {
  try {
    const raw = localStorage.getItem(ADDON_STORAGE_KEY);
    if (!raw) {
      // First run: save defaults
      localStorage.setItem(ADDON_STORAGE_KEY, JSON.stringify(DEFAULT_ADDON_URLS));
      return [...DEFAULT_ADDON_URLS];
    }
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_ADDON_URLS];
  } catch {
    return [...DEFAULT_ADDON_URLS];
  }
}

export function saveAddonUrls(urls: string[]): void {
  try {
    localStorage.setItem(ADDON_STORAGE_KEY, JSON.stringify(urls));
  } catch {
    // Storage full or unavailable
  }
}

export function initProviders(): void {
  // Clear existing
  providers.length = 0;

  // 1. TMDB — if API key configured
  const tmdbKey = import.meta.env.VITE_TMDB_KEY;
  if (tmdbKey) {
    registerProvider(new TmdbProvider());
  }

  // 3. Stremio Addons (Official open catalogs + User installed community addons)
  const addonUrls = getSavedAddonUrls();
  for (const url of addonUrls) {
    const addon = new AddonProvider(url);
    registerProvider(addon);
    // Asynchronously preload manifest in background
    addon.loadManifest().catch(() => {});
  }
}

export async function addAddon(url: string) {
  const cleanUrl = url.trim().replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
  const addon = new AddonProvider(cleanUrl);
  const manifest = await addon.loadManifest();
  if (!manifest) {
    throw new Error('Invalid Stremio addon manifest: unable to load /manifest.json');
  }

  registerProvider(addon);

  const urls = getSavedAddonUrls();
  if (!urls.includes(cleanUrl)) {
    urls.push(cleanUrl);
    saveAddonUrls(urls);
  }

  return manifest;
}

export function removeAddon(url: string): void {
  const cleanUrl = url.trim().replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
  const id = `addon:${cleanUrl}`;
  const idx = providers.findIndex((p) => p.id === id);
  if (idx !== -1) {
    providers.splice(idx, 1);
  }

  const urls = getSavedAddonUrls().filter((u) => u !== cleanUrl);
  saveAddonUrls(urls);
}

export function getProviders(): ContentProvider[] {
  if (providers.length === 0) {
    initProviders();
  }
  return providers;
}

export function getAddonProviders(): AddonProvider[] {
  return getProviders().filter((p): p is AddonProvider => p instanceof AddonProvider);
}
