import { ClientInstance, elizaLogger } from '@elizaos/core';

export async function initializeClients(character: Character, runtime: IAgentRuntime) {
    const clients: ClientInstance[] = [];
    if (character.plugins?.length > 0) {
        for (const plugin of character.plugins) {
            // Initialize clients from plugins
        }
    }
    return clients;
}