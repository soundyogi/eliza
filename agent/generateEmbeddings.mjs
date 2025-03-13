// save as scripts/generate-embeddings.mjs
import { createClient } from '@supabase/supabase-js';

// Your credentials
const SUPABASE_URL = "https://ekcvueswdllhabupccoa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrY3Z1ZXN3ZGxsaGFidXBjY29hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyOTExOTMsImV4cCI6MjA1Njg2NzE5M30.ZyQ157FoOOcrtXoHQQPcrmYjEBJZ2F4Qhv8U-lG3Yhw";
const OPENAI_API_KEY = "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"; // Replace with your OpenAI API key

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
    // Extract text content from the document
    let textContent;
    try {
      const content = doc.content;
      if (typeof content === 'string') {
        textContent = content;
      } else if (content.text) {
        textContent = content.text;
      } else if (content.title && content.text) {
        textContent = `${content.title}\n\n${content.text}`;
      } else {
        textContent = JSON.stringify(content);
      }
    } catch (err) {
      console.error(`Error extracting text from document ${doc.id}:`, err);
      continue;
    }
    
    try {
      console.log(`Generating embedding for document ${doc.id}`);
      
      // Generate embedding with OpenAI API
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: textContent
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${errorData}`);
      }
      
      const data = await response.json();
      const embedding = data.data[0].embedding;
      
      console.log(`Got embedding with ${embedding.length} dimensions`);
      
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
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error(`Error generating embedding for document ${doc.id}:`, err);
    }
  }
}

// Execute the function
generateEmbeddings().catch(error => {
  console.error('Unhandled error:', error);
});