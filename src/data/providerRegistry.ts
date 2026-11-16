import type { ContentProvider } from '@/types';
import { TmdbProvider } from './providers/TmdbProvider';
import { AddonProvider } from './providers/AddonProvider';

const ADDON_STORAGE_KEY = 'endless_stream:addon_urls';

// Default addons enabled out of the box (Pure Emptiness: 0 addons by default).
// The client hosts zero scrapers and zero catalogs out of the box; users have complete freedom to add or remove any addons.
export const DEFAULT_ADDON_URLS: string[] = [];

const providers: ContentProvider[] = [];
let initialized = false;

function registerProvider(provider: ContentProvider): void {
  if (!providers.find((p) => p.id === provider.id)) {
    providers.push(provider);
  }
}

export function getSavedAddonUrls(): string[] {
  try {
    const raw = localStorage.getItem(ADDON_STORAGE_KEY);
    if (raw === null) {
      // First run: save empty default slate
      localStorage.setItem(ADDON_STORAGE_KEY, JSON.stringify(DEFAULT_ADDON_URLS));
      return [...DEFAULT_ADDON_URLS];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAddonUrls(urls: string[]): void {
  try {
    localStorage.setItem(ADDON_STORAGE_KEY, JSON.stringify(urls));
  } catch {
    // Storage full or unavailable
  }
}

export function clearAllAddons(): void {
  providers.length = 0;
  saveAddonUrls([]);
}

export function initProviders(): void {
  // Clear existing
  providers.length = 0;
  initialized = true;

  // 1. TMDB — if API key configured
  const tmdbKey = import.meta.env.VITE_TMDB_KEY;
  if (tmdbKey) {
    registerProvider(new TmdbProvider());
  }

  // 2. Stremio Addons (User installed community addons)
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
  if (!initialized) {
    initProviders();
  }
  return providers;
}

export function getAddonProviders(): AddonProvider[] {
  return getProviders().filter((p): p is AddonProvider => p instanceof AddonProvider);
}
