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
    const { data: items, error: itemsError } = await supabase
      .from('knowledge')
      .select('id, "agentId", content, embedding, "isShared"')
      .limit(5);
    
    if (itemsError) {
      console.error("Error fetching knowledge items:", itemsError);
      return;
    }

    console.log("Knowledge items found:", items.length);
    items.forEach(item => {
      console.log(`\nID: ${item.id}`);
      console.log(`AgentID: ${item.agentId}`);
      console.log(`Is Shared: ${item.isShared}`);
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
    
    // Prepare for tests
    const testQuery = items[0]?.content?.text?.substring(0, 50) || "Silver Haired Justin 99";
    
    // 2. Generate a test embedding
    console.log("\nGenerating test embedding...");
    
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
    
    // 3. Comprehensive Search Tests
    const testCases = [
      {
        name: "Test 1: Normal Search",
        params: {
          agentId: null,
          match_threshold: 0.1,
          match_count: 10,
          searchText: null
        }
      },
      {
        name: "Test 2: With Search Text",
        params: {
          agentId: null,
          match_threshold: 0.1,
          match_count: 10,
          searchText: testQuery.split(' ')[0]
        }
      },
      {
        name: "Test 3: Low Threshold",
        params: {
          agentId: null,
          match_threshold: 0.01,
          match_count: 10,
          searchText: null
        }
      }
    ];
    
    // Run each test case
    for (const testCase of testCases) {
      console.log(`\n${testCase.name}`);
      console.log('Parameters:', JSON.stringify(testCase.params, null, 2));
      
      try {
        const { data: results, error } = await supabase.rpc('search_knowledge', {
          query_agent_id: testCase.params.agentId,
          query_embedding: embedding,
          match_threshold: testCase.params.match_threshold,
          match_count: testCase.params.match_count,
          search_text: testCase.params.searchText
        });
        
        if (error) {
          console.error("Error in search:", error);
          continue;
        }
        
        console.log(`Results found: ${results.length}`);
        results.forEach((result, index) => {
          console.log(`\nResult ${index + 1}:`);
          console.log(`  Similarity: ${result.similarity}`);
          console.log(`  Agent ID: ${result.agent_id}`);
          
          // Truncate content for readability
          const contentPreview = typeof result.content === 'string' 
            ? result.content.substring(0, 100) 
            : JSON.stringify(result.content).substring(0, 100);
          console.log(`  Content Preview: ${contentPreview}...`);
        });
        
      } catch (testError) {
        console.error("Test case error:", testError);
      }
    }
    
  } catch (error) {
    console.error("Test search error:", error);
    console.error(error.stack);
  }
}

testSearch();