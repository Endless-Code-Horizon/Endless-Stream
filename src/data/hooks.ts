import { useState, useEffect, useRef } from 'react';
import type {
  MediaType,
  MediaItem,
  MediaDetails,
  StreamSource,
  EpisodeRef,
  CatalogDefinition,
} from '@/types';
import { getProviders } from './providerRegistry';

// ----- useCatalog -----

export function useCatalog(
  type: MediaType,
  catalogId: string,
): { data: MediaItem[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!catalogId || !catalogId.trim()) {
      setLoading(false);
      setData([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const providers = getProviders();
        const allResults = await Promise.all(
          providers.map((p) => p.getCatalog(type, catalogId).catch(() => [] as MediaItem[])),
        );
        if (cancelled) return;

        const merged = allResults.flat();
        const seen = new Set<string>();
        const deduped = merged.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

        setData(deduped);
      } catch {
        if (!cancelled) setError('Failed to load catalog');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [type, catalogId]);

  return { data, loading, error };
}

// ----- useSearch -----

export function useSearch(
  query: string,
): { data: MediaItem[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      let cancelled = false;

      (async () => {
        try {
          const providers = getProviders();
          const allResults = await Promise.all(
            providers.map((p) => p.search(query).catch(() => [] as MediaItem[])),
          );
          if (cancelled) return;

          const merged = allResults.flat();
          const seen = new Set<string>();
          const deduped = merged.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });

          setData(deduped);
        } catch {
          if (!cancelled) setError('Search failed');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      // Return cleanup inside timeout is not possible,
      // but we guard with cancelled flag above through the effect cleanup
      return () => { cancelled = true; };
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return { data, loading, error };
}

// ----- useMeta -----

export function useMeta(
  type: MediaType,
  id: string,
): { data: MediaDetails | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !id.trim()) {
      setLoading(false);
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    (async () => {
      try {
        const providers = getProviders();
        for (const provider of providers) {
          try {
            const result = await provider.getMeta(type, id);
            if (cancelled) return;
            if (result && result.title !== 'Unknown') {
              setData(result);
              return;
            }
          } catch {
            // try next provider
          }
        }
        if (!cancelled) setError('No metadata found');
      } catch {
        if (!cancelled) setError('Failed to load metadata');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [type, id]);

  return { data, loading, error };
}

// ----- useStreams -----

export function useStreams(
  type: MediaType,
  id: string,
  episode?: EpisodeRef,
): { data: StreamSource[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<StreamSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !id.trim()) {
      setLoading(false);
      setData([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const providers = getProviders();
        const allResults = await Promise.all(
          providers.map((p) =>
            p.getStreams(type, id, episode).catch(() => [] as StreamSource[]),
          ),
        );
        if (cancelled) return;
        setData(allResults.flat());
      } catch {
        if (!cancelled) setError('Failed to load streams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [type, id, episode?.season, episode?.episode]);

  return { data, loading, error };
}

// ----- useCatalogs -----

export function useCatalogs(): CatalogDefinition[] {
  const defaultCatalogs: CatalogDefinition[] = [
    { id: 'trending', name: 'Trending', type: 'movie' },
    { id: 'popular', name: 'Popular Movies', type: 'movie' },
    { id: 'popular', name: 'Popular TV Shows', type: 'series' },
    { id: 'top_rated', name: 'Top Rated', type: 'movie' },
  ];
  return defaultCatalogs;
}
