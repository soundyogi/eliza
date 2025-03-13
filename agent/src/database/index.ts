import { type Adapter, AgentRuntime } from '@elizaos/core';

export async function findDatabaseAdapter(runtime: AgentRuntime) {
    const { adapters } = runtime;
    let adapter: Adapter | undefined;
    if (adapters.length === 0) {
        const sqliteAdapterPlugin = await import('@elizaos-plugins/adapter-sqlite');
        const sqliteAdapterPluginDefault = sqliteAdapterPlugin.default;
        adapter = sqliteAdapterPluginDefault.adapters[0];
        if (!adapter) {
            throw new Error("Internal error: No database adapter found for default adapter-sqlite");
        }
    } else if (adapters.length === 1) {
        adapter = adapters[0];
    } else {
        throw new Error("Multiple database adapters found. You must have no more than one.");
    }
    const adapterInterface = adapter?.init(runtime);
    return adapterInterface;
}