import fs from "fs";
import path from "path";
import JSON5 from "json5";
import { fileURLToPath } from "url";
import {
  elizaLogger,
  type Character,
  validateCharacterConfig
} from "@elizaos/core";

import { defaultCharacter } from "../defaultCharacter.ts";

// --- File Reading & Merging Helpers ---
export function tryLoadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (e) {
    return null;
  }
}

export function mergeCharacters(base: Character, child: Character): Character {
  const mergeObjects = (baseObj: any, childObj: any) => {
    const result: any = {};
    const keys = new Set([...Object.keys(baseObj || {}), ...Object.keys(childObj || {})]);
    keys.forEach(key => {
      if (
        typeof baseObj[key] === "object" &&
        typeof childObj[key] === "object" &&
        !Array.isArray(baseObj[key]) &&
        !Array.isArray(childObj[key])
      ) {
        result[key] = mergeObjects(baseObj[key], childObj[key]);
      } else if (Array.isArray(baseObj[key]) || Array.isArray(childObj[key])) {
        result[key] = [...(baseObj[key] || []), ...(childObj[key] || [])];
      } else {
        result[key] = childObj[key] !== undefined ? childObj[key] : baseObj[key];
      }
    });
    return result;
  };
  return mergeObjects(base, child);
}

export function commaSeparatedStringToArray(commaSeparated: string): string[] {
  return commaSeparated?.split(",").map(s => s.trim()) || [];
}

export async function readCharactersFromStorage(characterPaths: string[]): Promise<string[]> {
  try {
    const uploadDir = path.join(process.cwd(), "data", "characters");
    await fs.promises.mkdir(uploadDir, { recursive: true });
    const fileNames = await fs.promises.readdir(uploadDir);
    fileNames.forEach(fileName => characterPaths.push(path.join(uploadDir, fileName)));
  } catch (err: any) {
    elizaLogger.error(`Error reading directory: ${err.message}`);
  }
  return characterPaths;
}

// --- Character Conversion & Loading ---
export async function jsonToCharacter(filePath: string, character: any): Promise<Character> {
  validateCharacterConfig(character);
  const characterId = character.id || character.name;
  const characterPrefix = `CHARACTER.${characterId.toUpperCase().replace(/ /g, "_")}.`;
  const characterSettings = Object.entries(process.env)
    .filter(([key]) => key.startsWith(characterPrefix))
    .reduce((settingsObj, [key, value]) => {
      const settingKey = key.slice(characterPrefix.length);
      return { ...settingsObj, [settingKey]: value };
    }, {});
  if (Object.keys(characterSettings).length > 0) {
    character.settings = character.settings || {};
    character.settings.secrets = { ...characterSettings, ...character.settings.secrets };
  }
  // Load plugins for the character.
  character.plugins = await handlePluginImporting(character.plugins);
  elizaLogger.info(
    character.name,
    "loaded plugins:",
    "[ " + character.plugins.map((p: any) => `"${p.npmName}"`).join(", ") + " ]"
  );
  // Load postProcessors if defined.
  if (character.postProcessors?.length > 0) {
    elizaLogger.info(character.name, "loading postProcessors", character.postProcessors);
    character.postProcessors = await handlePluginImporting(character.postProcessors);
  }
  // Handle inheritance (extends).
  if (character.extends) {
    elizaLogger.info(`Merging ${character.name} with parent characters`);
    for (const extendPath of character.extends) {
      const baseCharacter = await loadCharacter(path.resolve(path.dirname(filePath), extendPath));
      character = mergeCharacters(baseCharacter, character);
      elizaLogger.info(`Merged ${character.name} with ${baseCharacter.name}`);
    }
  }
  return character;
}

export async function loadCharacter(filePath: string): Promise<Character> {
  const content = tryLoadFile(filePath);
  if (!content) {
    throw new Error(`Character file not found: ${filePath}`);
  }
  const character = JSON5.parse(content);
  return jsonToCharacter(filePath, character);
}

export async function loadCharacterTryPath(characterPath: string, dirname: string): Promise<Character> {
  let content: string | null = null;
  let resolvedPath = "";
  const pathsToTry = [
    characterPath,
    path.resolve(process.cwd(), characterPath),
    path.resolve(process.cwd(), "agent", characterPath),
    path.resolve(dirname, characterPath),
    path.resolve(dirname, "characters", path.basename(characterPath)),
    path.resolve(dirname, "../characters", path.basename(characterPath)),
    path.resolve(dirname, "../../characters", path.basename(characterPath))
  ];
  elizaLogger.debug("Trying paths:", pathsToTry.map(p => ({ path: p, exists: fs.existsSync(p) })));
  for (const tryPath of pathsToTry) {
    content = tryLoadFile(tryPath);
    if (content !== null) {
      resolvedPath = tryPath;
      break;
    }
  }
  if (content === null) {
    elizaLogger.error(`Error loading character from ${characterPath}: File not found in expected locations.`);
    pathsToTry.forEach(p => elizaLogger.error(` - ${p}`));
    throw new Error(`Error loading character from ${characterPath}: File not found.`);
  }
  try {
    const character: Character = await loadCharacter(resolvedPath);
    elizaLogger.success(`Successfully loaded character from: ${resolvedPath}`);
    return character;
  } catch (e) {
    console.error(`Error parsing character from ${resolvedPath}:`, e);
    throw new Error(`Error parsing character from ${resolvedPath}: ${e}`);
  }
}

export async function loadCharacters(charactersArg: string, dirname): Promise<Character[]> {
  let characterPaths = commaSeparatedStringToArray(charactersArg);
  if (process.env.USE_CHARACTER_STORAGE === "true") {
    characterPaths = await readCharactersFromStorage(characterPaths);
  }
  const loadedCharacters: Character[] = [];
  if (characterPaths?.length > 0) {
    for (const characterPath of characterPaths) {
      try {
        const character: Character = await loadCharacterTryPath(characterPath, dirname);
        loadedCharacters.push(character);
      } catch (e) {
        process.exit(1);
      }
    }
  }
  if (process.env.REMOTE_CHARACTER_URLS && process.env.REMOTE_CHARACTER_URLS.startsWith("http")) {
    elizaLogger.info("Loading characters from remote URLs");
    const characterUrls = commaSeparatedStringToArray(process.env.REMOTE_CHARACTER_URLS);
    for (const characterUrl of characterUrls) {
      const remoteCharacters = await loadCharactersFromUrl(characterUrl);
      loadedCharacters.push(...remoteCharacters);
    }
  }
  if (loadedCharacters.length === 0) {
    elizaLogger.info("No characters found, using default character");
    loadedCharacters.push(defaultCharacter);
  }
  return loadedCharacters;
}

export async function loadCharactersFromUrl(url: string): Promise<Character[]> {
  try {
    const response = await fetch(url);
    const responseJson = await response.json();
    let characters: Character[] = [];
    if (Array.isArray(responseJson)) {
      characters = await Promise.all(responseJson.map(ch => jsonToCharacter(url, ch)));
    } else {
      const character = await jsonToCharacter(url, responseJson);
      characters.push(character);
    }
    return characters;
  } catch (e) {
    console.error(`Error loading character(s) from ${url}:`, e);
    process.exit(1);
  }
}

// --- Plugin & Post-Processing Helpers ---
export async function handlePluginImporting(plugins: string[]): Promise<any[]> {
  if (plugins?.length > 0) {
    const importedPlugins = await Promise.all(
      plugins.map(async plugin => {
        try {
          const importedPlugin: any = await import(plugin);
          const functionName =
            plugin
              .replace("@elizaos/plugin-", "")
              .replace("@elizaos-plugins/plugin-", "")
              .replace(/-./g, x => x[1].toUpperCase()) + "Plugin";
          if (!importedPlugin[functionName] && !importedPlugin.default) {
            elizaLogger.warn(plugin, "does not have a default export or expected function", functionName);
          }
          return { ...(importedPlugin.default || importedPlugin[functionName]), npmName: plugin };
        } catch (importError) {
          console.error(`Failed to import plugin: ${plugin}`, importError);
          return false;
        }
      })
    );
    return importedPlugins.filter(p => !!p);
  } else {
    return [];
  }
}

export async function handlePostCharacterLoaded(character: Character): Promise<Character> {
  let processedCharacter = character;
  const processors = character?.postProcessors?.filter(p => typeof p.handlePostCharacterLoaded === "function");
  if (processors?.length > 0) {
    processedCharacter = { ...character, postProcessors: undefined };
    for (const processor of processors) {
      processedCharacter = await processor.handlePostCharacterLoaded(processedCharacter);
    }
  }
  return processedCharacter;
}