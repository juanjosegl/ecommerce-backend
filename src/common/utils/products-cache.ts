import { Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';

const VERSION_KEY = 'products:version';
const CACHE_TIMEOUT_MS = 800;
const logger = new Logger('ProductsCache');

/**
 * The cache is an optimisation, never a dependency: if Redis is slow or down
 * (e.g. a free-tier instance that went to sleep) reads fall through to the
 * database instead of hanging the request.
 */
async function safe<T>(op: Promise<T>, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), CACHE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([op, timeout]);
  } catch (error) {
    logger.warn(`Cache unavailable: ${(error as Error).message}`);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export function cacheGet<T>(cache: Cache, key: string) {
  return safe(cache.get<T>(key), undefined);
}

export function cacheSet(cache: Cache, key: string, value: unknown) {
  return safe(cache.set(key, value), undefined);
}

/**
 * Product reads are cached under a version stamp. Bumping the stamp makes every
 * old entry unreachable at once, without scanning or flushing Redis. If the
 * stamp itself expires, entries written under the old stamp have expired too
 * (same TTL), so a reset to 0 never serves stale data.
 */
export async function productsCacheKey(cache: Cache, suffix: string) {
  const version = (await cacheGet<number>(cache, VERSION_KEY)) ?? 0;
  return `products:v${version}:${suffix}`;
}

export async function invalidateProductsCache(cache: Cache) {
  await cacheSet(cache, VERSION_KEY, Date.now());
}
