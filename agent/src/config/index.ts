import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export function parseArguments() {
    try {
        return yargs(hideBin(process.argv))
            .option("character", {
                type: "string",
                description: "Path to the character JSON file",
            })
            .option("characters", {
                type: "string",
                description: "Comma separated list of paths to character JSON files",
            })
            .parseSync();
    } catch (error) {
        console.error("Error parsing arguments:", error);
        return {};
    }
}

export function getTokenForProvider(provider: ModelProviderName, character: Character): string | undefined {
    switch (provider) {
        // Add cases for different providers
        default:
            const errorMessage = `Failed to get token - unsupported model provider: ${provider}`;
            elizaLogger.error(errorMessage);
            throw new Error(errorMessage);
    }
}