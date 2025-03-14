// test-search.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
fs.existsSync(envPath) ? dotenv.config({ path: envPath }) : dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function testSearch() {
  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // 1. First check knowledge items directly
    const { data: items } = await supabase
      .from('knowledge')
      .select('id, "agentId", content, embedding')
      .limit(5);
    
    console.log("Knowledge items found:", items.length);
    items.forEach(item => {
      console.log(`\nID: ${item.id}`);
      console.log(`AgentID: ${item.agentId}`);
      console.log(`Has embedding: ${!!item.embedding}`);
      console.log(`Embedding length: ${item.embedding?.length || 0}`);
      
      let textContent = '';
      if (typeof item.content === 'string') {
        textContent = item.content;
      } else if (item.content?.text) {
        textContent = item.content.text;
      } else {
        textContent = JSON.stringify(item.content);
      }
      console.log(`Content preview: ${textContent.substring(0, 50)}...`);
    });
    
    // Get the agent ID from the first knowledge item to use in our tests
    const testAgentId = items[0]?.agentId;
    console.log("\nUsing agent ID for testing:", testAgentId);
    
    // 2. Generate a test embedding
    console.log("\nGenerating test embedding...");
    
    // Use a query that should match the first document
    const testQuery = items[0]?.content?.text?.substring(0, 50) || "Silver Haired Justin 99";
    console.log("Test query:", testQuery);
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: testQuery
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }
    
    const data = await response.json();
    const embedding = data.data[0].embedding;
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // 3. Try search with various parameters
    
    // Test 1: With exact agent ID and extremely low threshold
    console.log("\n--- Test 1: With exact agent ID and low threshold ---");
    const { data: test1Results, error: test1Error } = await supabase.rpc('search_knowledge', {
      query_agent_id: testAgentId,
      query_embedding: embedding,
      match_threshold: 0.0001,
      match_count: 10,
      search_text: null
    });
    
    if (test1Error) {
      console.error("Test 1 Error:", test1Error);
    } else {
      console.log("Test 1 Results:", test1Results.length);
      test1Results.forEach((result, i) => {
        console.log(`  Result ${i+1}: similarity=${result.similarity.toFixed(4)}`);
      });
    }
    
    // Test 2: With null agent ID to match all
    console.log("\n--- Test 2: With null agent ID ---");
    const { data: test2Results, error: test2Error } = await supabase.rpc('search_knowledge', {
      query_agent_id: null,
      query_embedding: embedding,
      match_threshold: 0.0001,
      match_count: 10,
      search_text: null
    });
    
    if (test2Error) {
      console.error("Test 2 Error:", test2Error);
    } else {
      console.log("Test 2 Results:", test2Results.length);
      test2Results.forEach((result, i) => {
        console.log(`  Result ${i+1}: similarity=${result.similarity.toFixed(4)}, agent_id=${result.agent_id}`);
      });
    }
    
    // Test 3: With very negative threshold to get everything
    console.log("\n--- Test 3: With negative threshold to match everything ---");
    const { data: test3Results, error: test3Error } = await supabase.rpc('search_knowledge', {
      query_agent_id: testAgentId,
      query_embedding: embedding,
      match_threshold: -1,  // Should return everything
      match_count: 10,
      search_text: null
    });
    
    if (test3Error) {
      console.error("Test 3 Error:", test3Error);
    } else {
      console.log("Test 3 Results:", test3Results.length);
      test3Results.forEach((result, i) => {
        console.log(`  Result ${i+1}: similarity=${result.similarity.toFixed(4)}`);
      });
    }
    
    // Test 4: With search text only
    console.log("\n--- Test 4: With search text only ---");
    const { data: test4Results, error: test4Error } = await supabase.rpc('search_knowledge', {
      query_agent_id: testAgentId,
      query_embedding: embedding,
      match_threshold: 0.0001,
      match_count: 10,
      search_text: testQuery.split(' ')[0]  // Just use the first word
    });
    
    if (test4Error) {
      console.error("Test 4 Error:", test4Error);
    } else {
      console.log("Test 4 Results:", test4Results.length);
      test4Results.forEach((result, i) => {
        console.log(`  Result ${i+1}: similarity=${result.similarity.toFixed(4)}`);
      });
    }
    
    
  } catch (error) {
    console.error("Test search error:", error);
    console.error(error.stack);
  }
}

testSearch();