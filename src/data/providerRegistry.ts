import type { ContentProvider } from '@/types';
import { TmdbProvider } from './providers/TmdbProvider';
import { AddonProvider } from './providers/AddonProvider';

export const CINEMETA_URL = 'https://v3-cinemeta.strem.io';
export const DEFAULT_ADDON_URLS: string[] = [CINEMETA_URL];

const providers: ContentProvider[] = [];
let initialized = false;

function registerProvider(provider: ContentProvider): void {
  if (!providers.find((p) => p.id === provider.id)) {
    providers.push(provider);
  }
}

export function getSavedAddonUrls(): string[] {
  // Read-only showcase mode: always return Cinemeta only, ignoring external localStorage manifests
  return [CINEMETA_URL];
}

export function saveAddonUrls(_urls: string[]): void {
  // Read-only in showcase mode: custom add-on persistence disabled
}

export function clearAllAddons(): void {
  // In showcase mode, reset back to Cinemeta only
  initProviders();
}

export function initProviders(): void {
  providers.length = 0;
  initialized = true;

  // 1. TMDB — if API key configured
  const tmdbKey = import.meta.env.VITE_TMDB_KEY;
  if (tmdbKey) {
    registerProvider(new TmdbProvider());
  }

  // 2. Cinemeta (Official public metadata provider)
  const cinemeta = new AddonProvider(CINEMETA_URL);
  registerProvider(cinemeta);
  cinemeta.loadManifest().catch(() => {});
}

export async function addAddon(_url: string) {
  throw new Error('Showcase Mode: Custom add-on installation is disabled.');
}

export function removeAddon(_url: string): void {
  // Disabled in showcase mode
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
