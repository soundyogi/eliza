import { ClientInstance, elizaLogger, type Character, type IAgentRuntime } from '@elizaos/core';

export async function initializeClients(character: Character, runtime: IAgentRuntime) {
    const clients: ClientInstance[] = [];
    if (character.plugins?.length > 0) {
        for (const plugin of character.plugins) {
            if (plugin.clients) {
                for (const client of plugin.clients) {
                    const startedClient = await client.start(runtime);
                    elizaLogger.debug(`Initializing client: ${client.name}`);
                    clients.push(startedClient);
                }
            }
        }
    }
    return clients;
}