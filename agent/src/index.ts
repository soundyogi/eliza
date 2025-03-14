import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
  type IDatabaseAdapter,
  type IDatabaseCacheAdapter,
  CacheStore,
  parseBooleanFromText,
  embed
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import path from "path";
import { fileURLToPath } from "url";

import { defaultCharacter } from "./defaultCharacter.ts";
import { initializeCache as initCache } from "./cache/index.ts";
import { startChatSession } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import { getTokenForProvider as getToken, parseArguments as parseArgs } from "./config/index.ts";
import { findDatabaseAdapter } from "./database/index.ts";
import {
  loadCharacters,
  loadCharacterTryPath,
  jsonToCharacter,
  handlePluginImporting,
  handlePostCharacterLoaded
} from "./characters/index.ts";
import { checkPortAvailable, wait } from "./util.ts";

// Necessary for ES Modules:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFetch = async (url: string, options: any) => {
  elizaLogger.debug(`Fetching ${url}`);
  // (Sensitive options logging disabled)
  return fetch(url, options);
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
    fetch: logFetch
  });
}

async function startAgent(character: Character, directClient: DirectClient): Promise<AgentRuntime> {
  let db: IDatabaseAdapter & IDatabaseCacheAdapter;
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getToken(character.modelProvider, character);
    const runtime: AgentRuntime = await createAgent(character, token);

    db = await findDatabaseAdapter(runtime);
    runtime.databaseAdapter = db;


    const cache = initCache(
      process.env.CACHE_STORE ?? CacheStore.DATABASE,
      character,
      process.env.CACHE_DIR ?? "",
      db
    );
    runtime.cacheManager = cache;

    await runtime.initialize();
    runtime.clients = await initializeClients(character, runtime);

    directClient.registerAgent(runtime);
    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

    const knowledgeItems = await runtime.databaseAdapter.getKnowledge({
      agentId: runtime.agentId,
      limit: 10
    });
    console.log('Knowledge items found:', knowledgeItems.length);

    try {
      console.log("Running direct search test...");
      
      // Log the agent ID being used
      console.log("Using agent ID:", runtime.agentId);
      
      // Generate embedding for test
      const testEmbeddingArray = await embed(runtime, "Silver Haired Justin 99");
      console.log("Generated embedding length:", testEmbeddingArray.length);
      
      
      // Test 1: With vector search only
      console.log("\n--- Test 1: Vector search with agentId ---");
      const directResults = await runtime.databaseAdapter.searchKnowledge({
        agentId: runtime.agentId,
        embedding: new Float32Array(testEmbeddingArray),
        match_threshold: 0.3, // Extremely low
        match_count: 10,      // Very high
      });
      
      console.log(`Direct search results: ${directResults.length} items found`);
      if (directResults.length > 0) {
        directResults.forEach((item, index) => {
          console.log(item)
          console.log(`Result ${index+1}: similarity=${item.similarity}, text=${item.content.text.substring(0, 50)}...`);
        });
      } else {
        console.log("No results - trying fallback approach...");
        
        // Test 2: Try with null agent ID
        console.log("\n--- Test 2: Trying with null agentId ---");
        const nullAgentResults = await runtime.databaseAdapter.searchKnowledge({
          agentId: null, 
          embedding: new Float32Array(testEmbeddingArray),
          match_threshold: 0.3,
          match_count: 10
        });
        
        if (nullAgentResults.length > 0) {
          
          console.log(`Found ${nullAgentResults.length} results with null agentId!`);
          nullAgentResults.forEach((item, index) => {
            console.log(item)
            console.log(`Result ${index+1}: similarity=${item.similarity}, text=${item.content.text.substring(0, 50)}...`);
          });
        } 
      }
    } catch (error) {
      console.error("Error in direct search test:", error);
      console.error(error.stack);
    }

    // debugKnowledgeSearch(runtime, "Silver Haired Justin 99");

    return runtime;
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error);
    if (db) await db.close();
    throw error;
  }
}

const startAgents = async () => {
  const directClient = new DirectClient();
  let serverPort = Number.parseInt(settings.SERVER_PORT || "3000");
  const args = parseArgs();
  const charactersArg = args.characters || args.character;
  let characters: Character[] = [defaultCharacter];

  if (charactersArg || (process.env.REMOTE_CHARACTER_URLS && process.env.REMOTE_CHARACTER_URLS.startsWith("http"))) {
    characters = await loadCharacters(charactersArg, __dirname);
  }

  try {
    for (const character of characters) {
      const processedCharacter = await handlePostCharacterLoaded(character);
      await startAgent(processedCharacter, directClient);
    }
  } catch (error) {
    elizaLogger.error("Error starting agents:", error);
  }

  while (!(await checkPortAvailable(serverPort))) {
    elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
    serverPort++;
  }

  directClient.startAgent = async (character) => {
    character.plugins = await handlePluginImporting(character.plugins);
    elizaLogger.info(
      character.name,
      "loaded plugins:",
      "[" + character.plugins.map((p: any) => `"${p.npmName}"`).join(", ") + "]"
    );
    if (character.postProcessors?.length > 0) {
      elizaLogger.info(character.name, "loading postProcessors", character.postProcessors);
      character.postProcessors = await handlePluginImporting(character.postProcessors);
    }
    const processedCharacter = await handlePostCharacterLoaded(character);
    return startAgent(processedCharacter, directClient);
  };

  // Expose helper functions on the client for external access if needed.
  (directClient as any).loadCharacterTryPath = loadCharacterTryPath;
  (directClient as any).jsonToCharacter = jsonToCharacter;

  directClient.start(serverPort);

  if (serverPort !== Number.parseInt(settings.SERVER_PORT || "3000")) {
    elizaLogger.warn(`Server started on alternate port ${serverPort}`);
  }

  elizaLogger.info("Run `pnpm start:client` to start the client and visit the output URL to chat with your agents.");

  // Optionally start chat session if not running as daemon.
  const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
  if (!isDaemonProcess) {
    await wait(10000);
    console.log("Starting chat session...");
    startChatSession(characters)();
  }
};

startAgents().catch(error => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});

// Prevent unhandled exceptions if desired.
if (process.env.PREVENT_UNHANDLED_EXIT && parseBooleanFromText(process.env.PREVENT_UNHANDLED_EXIT)) {
  process.on("uncaughtException", err => {
    console.error("uncaughtException", err);
  });
  process.on("unhandledRejection", err => {
    console.error("unhandledRejection", err);
  });
}

async function debugKnowledgeSearch(runtime, testQuery) {
  const knowledgeManager = runtime.ragKnowledgeManager;

  console.log('Debugging Knowledge Search');
  
  // Step 1: List all knowledge items
  const allKnowledge = await knowledgeManager.listAllKnowledge(runtime.agentId);
  console.log(`Total knowledge items: ${allKnowledge.length}`);
  
  // Detailed logging of knowledge items
  allKnowledge.forEach((item, index) => {
    console.log(item)
    console.log(`Item ${index + 1}:`, {
      id: item.id,
      agentId: item.agentId,
      isShared: item.content.metadata?.isShared,
      text: item.content.text.substring(0, 100) + '...'
    });
  });

  // Generate embedding for test query
  const embeddingArray = await embed(runtime, testQuery);
  const embedding = new Float32Array(embeddingArray);


  // Step 2: Perform searches with different configurations
  console.log('\n--- Search with Specific Agent ID ---');
  const resultsWithAgentId = await runtime.databaseAdapter.searchKnowledge({
    agentId: runtime.agentId,
    embedding: embedding,
    match_threshold: 0.0001,
    match_count: 10
  });
  console.log(`Results with agent ID: ${resultsWithAgentId.length}`);
  resultsWithAgentId.forEach((result, index) => {
    console.log(`Result ${index + 1}:`, {
      id: result.id,
      agentId: result.agentId,
      similarity: result.similarity,
      isShared: result.content.metadata?.isShared,
      textPreview: result.content.text.substring(0, 100) + '...'
    });
  });

  console.log('\n--- Search with NULL Agent ID ---');
  const resultsWithNullAgentId = await runtime.databaseAdapter.searchKnowledge({
    agentId: null,
    embedding: embedding,
    match_threshold: 0.0001,
    match_count: 10
  });
  console.log(`Results with NULL agent ID: ${resultsWithNullAgentId.length}`);
  resultsWithNullAgentId.forEach((result, index) => {
    console.log(`Result ${index + 1}:`, {
      id: result.id,
      agentId: result.agentId,
      similarity: result.similarity,
      isShared: result.content.metadata?.isShared,
      textPreview: result.content.text.substring(0, 100) + '...'
    });
  });

  // Direct database query for verification
  try {
    const directResults = await runtime.databaseAdapter.searchKnowledge({
      agentId: runtime.agentId,
      embedding: embedding,
      match_threshold: 0.0001,
      match_count: 10
    });
    console.log('\n--- Direct Database Search with Runtime AgentID ---');
    console.log(`Results: ${directResults.length}`);
    directResults.forEach((result, index) => {
      console.log(`Result ${index + 1}:`, {
        id: result.id,
        agentId: result.agentId,
        similarity: result.similarity,
        isShared: result.content.metadata?.isShared,
        textPreview: result.content.text.substring(0, 100) + '...'
      });
    });
  } catch (error) {
    console.error('Error in direct database search:', error);
  }
}

export default debugKnowledgeSearch;