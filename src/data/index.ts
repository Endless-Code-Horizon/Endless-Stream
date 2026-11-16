// Data layer entry point
import { initProviders } from './providerRegistry';

// Initialize providers on module load
initProviders();

export {
  useCatalog,
  useSearch,
  useMeta,
  useStreams,
  useCatalogs,
} from './hooks';

export {
  initProviders,
  addAddon,
  removeAddon,
  clearAllAddons,
  getProviders,
  getAddonProviders,
  getSavedAddonUrls,
  DEFAULT_ADDON_URLS,
  CINEMETA_URL,
} from './providerRegistry';
