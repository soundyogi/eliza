// save as scripts/generate-embeddings.js
import { createClient } from '@supabase/supabase-js';

// Your credentials (replace with your actual values)
const SUPABASE_URL = "https://ekcvueswdllhabupccoa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrY3Z1ZXN3ZGxsaGFidXBjY29hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyOTExOTMsImV4cCI6MjA1Njg2NzE5M30.ZyQ157FoOOcrtXoHQQPcrmYjEBJZ2F4Qhv8U-lG3Yhw";
const ANTHROPIC_API_KEY = "YOUR_ANTHROPIC_API_KEY"; // Replace with your actual API key

async function generateEmbeddings() {
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Get knowledge docs without embeddings
  const { data: documents, error } = await supabase
    .from('knowledge')
    .select('id, content')
    .is('embedding', null);
    
  if (error) {
    console.error('Error fetching documents:', error);
    return;
  }
    
  console.log(`Found ${documents.length} documents without embeddings`);
  
  // Process each document
  for (const doc of documents) {
    const content = typeof doc.content === 'string' 
      ? doc.content 
      : JSON.stringify(doc.content);
    
    try {
      // Generate embedding with Anthropic API using fetch
      const response = await fetch('https://api.anthropic.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          input: content,
          dimensions: 1536  // Match the vector dimension in your schema
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      const embedding = data.embedding;
      
      // Update document with embedding
      const { error: updateError } = await supabase
        .from('knowledge')
        .update({ embedding })
        .eq('id', doc.id);
        
      if (updateError) {
        console.error(`Error updating embedding for document ${doc.id}:`, updateError);
      } else {
        console.log(`Updated embedding for document ${doc.id}`);
      }
      
      // Sleep for a short time to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (err) {
      console.error(`Error generating embedding for document ${doc.id}:`, err);
    }
  }
}

// Execute the function
generateEmbeddings().catch(error => {
  console.error('Unhandled error:', error);
});