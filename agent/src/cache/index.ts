import { CacheManager, FsCacheAdapter, DbCacheAdapter, type Character, type IDatabaseCacheAdapter, CacheStore } from '@elizaos/core';
import path from 'path';

export function initializeFsCache(baseDir: string, character: Character) {
    if (!character?.id) {
        throw new Error(
            "initializeFsCache requires id to be set in character definition"
        );
    }
    const cacheDir = path.resolve(baseDir, character.id, "cache");

    const cache = new CacheManager(new FsCacheAdapter(cacheDir));
    return cache;
}

export function initializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
    if (!character?.id) {
        throw new Error(
            "initializeFsCache requires id to be set in character definition"
        );
    }
    const cache = new CacheManager(new DbCacheAdapter(db, character.id));
    return cache;
}

export function initializeCache(
    cacheStore: string,
    character: Character,
    baseDir?: string,
    db?: IDatabaseCacheAdapter
) {
    switch (cacheStore) {
        case CacheStore.DATABASE:
            return initializeDbCache(character, db);
        case CacheStore.FILESYSTEM:
            return initializeFsCache(baseDir, character);
        default:
            throw new Error(
                `Invalid cache store: ${cacheStore} or required configuration missing.`
            );
    }
}