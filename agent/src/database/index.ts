import { type Adapter, AgentRuntime } from '@elizaos/core';
export async function findDatabaseAdapter(runtime: AgentRuntime) {
    const { adapters } = runtime;
    let adapter: Adapter | undefined;
    console.log("adapters", adapters);
    // First check if Supabase adapter is already loaded

            
        const supabaseAdapterPlugin = await import('@elizaos-plugins/sntnt-adapter-supabase');
        const supabaseAdapterPluginDefault = supabaseAdapterPlugin.default;
        adapter = supabaseAdapterPluginDefault.adapters[0];
 


    /*
    // If still no adapter and no other adapters are present, fall back to SQLite
    if (!adapter && adapters.length === 0) {
        const sqliteAdapterPlugin = await import('@elizaos-plugins/adapter-sqlite');
        const sqliteAdapterPluginDefault = sqliteAdapterPlugin.default;
        adapter = sqliteAdapterPluginDefault.adapters[0];
        if (!adapter) {
            throw new Error("Internal error: No database adapter found for default adapter-sqlite");
        }
    } else if (!adapter && adapters.length === 1) {
        // Use the single available adapter if Supabase wasn't found
        adapter = adapters[0];
    } else if (!adapter && adapters.length > 1) {
        throw new Error("Multiple database adapters found. You must have no more than one.");
    }
    */
    const adapterInterface = adapter?.init(runtime);
    return adapterInterface;
}