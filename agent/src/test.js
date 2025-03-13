// direct-test.js
import { createClient } from '@supabase/supabase-js';

// Replace with your actual credentials
const SUPABASE_URL = "https://ekcvueswdllhabupccoa.supabase.co";
const SUPABASE_ANON_KEY = "your-key-here";

async function testDirectly() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Get knowledge items for reference
  const { data: knowledgeItems } = await supabase
    .from('knowledge')
    .select('id, content->text as text')
    .limit(5);
  
  console.log("Knowledge items:", knowledgeItems);
  
  // Call the function directly with a hardcoded query
  const { data, error } = await supabase.rpc('search_knowledge', {
    query_agent_id: '2097715f-e41a-0b67-868d-90df38e959fa',
    query_embedding: Array(1536).fill(0.1), // Simple test embedding
    match_threshold: 0,                     // No threshold
    match_count: 10,
    search_text: 'test'
  });
  
  if (error) {
    console.error("Error calling function:", error);
  } else {
    console.log("Results:", data);
  }
}

testDirectly().catch(console.error);