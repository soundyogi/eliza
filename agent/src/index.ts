import { DirectClient } from "@elizaos/client-direct";
import { AgentRuntime, elizaLogger, settings, stringToUuid, type Character } from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { initializeCache } from "./cache/index.ts";
import { startChatSession } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import { getTokenForProvider, parseArguments } from "./config/index.ts";
import { findDatabaseAdapter } from "./database/index.ts";
import { defaultCharacter } from "./defaultCharacter.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const wait = (minTime = 1000, maxTime = 3000) => {
    const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

export function createAgent(character: Character, token: string): AgentRuntime {
    elizaLogger.log(`Creating runtime for character ${character.name}`);
    return new AgentRuntime({
        token,
        modelProvider: character.modelProvider,
        evaluators: [],
        character,
        plugins: [bootstrapPlugin].filter(Boolean),
        providers: [],
        managers: [],
        fetch: logFetch,
    });
}

async function startAgent(character: Character, directClient: DirectClient): Promise<AgentRuntime> {
    let db: IDatabaseAdapter & IDatabaseCacheAdapter;
    try {
        character.id ??= stringToUuid(character.name);
        character.username ??= character.name;

        const token = getTokenForProvider(character.modelProvider, character);
        const runtime: AgentRuntime = await createAgent(character, token);

        db = await findDatabaseAdapter(runtime);
        runtime.databaseAdapter = db;

        const cache = initializeCache(process.env.CACHE_STORE ?? "DATABASE", character, process.env.CACHE_DIR ?? "", db);
        runtime.cacheManager = cache;

        await runtime.initialize();
        runtime.clients = await initializeClients(character, runtime);

        directClient.registerAgent(runtime);
        elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

        return runtime;
    } catch (error) {
        elizaLogger.error(`Error starting agent for character ${character.name}:`, error);
        throw error;
    }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                resolve(false);
            }
        });
        server.once("listening", () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
};

const startAgents = async () => {
    const directClient = new DirectClient();
    let serverPort = parseInt(settings.SERVER_PORT || "3000");
    const args = parseArguments();
    let charactersArg = args.characters || args.character;
    let characters = [defaultCharacter];

    if (charactersArg) {
        characters = await loadCharacters(charactersArg);
    }

    try {
        for (const character of characters) {
            await startAgent(character, directClient);
        }
    } catch (error) {
        elizaLogger.error("Error starting agents:", error);
    }

    while (!(await checkPortAvailable(serverPort))) {
        elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
        serverPort++;
    }

    directClient.startAgent = async (character: Character) => {
        return startAgent(character, directClient);
    };

    directClient.start(serverPort);

    if (serverPort !== parseInt(settings.SERVER_PORT || "3000")) {
        elizaLogger.warn(`Server started on alternate port ${serverPort}`);
    }

    const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
    if (!isDaemonProcess) {
        startChatSession(characters);
    }
};

startAgents().catch((error) => {
    elizaLogger.error("Unhandled error in startAgents:", error);
    process.exit(1);
});