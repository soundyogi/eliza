import { startChat } from '@elizaos/core';

export function startChatSession(characters: Character[]) {
    elizaLogger.log("Chat started. Type 'exit' to quit.");
    const chat = startChat(characters);
    chat();
}