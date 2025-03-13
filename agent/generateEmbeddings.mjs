
// generateEmbeddings.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

console.log("envPath", envPath);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Get credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OPENAI_API_KEY) {
  console.error('Error: Missing required environment variables. Please check your .env file.');
  console.error('Required variables: SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY');
  process.exit(1);
}

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
        

        console.error(`Error updating embedding for document ${doc.id}:`, updateError);
        
        // Fallback to direct update if RPC fails
        console.log("Trying fallback direct update method...");
        const { error: fallbackError } = await supabase
          .from('knowledge')
          .update({ embedding })
          .eq('id', doc.id);
          
        if (fallbackError) {
          console.error(`Fallback update also failed for document ${doc.id}:`, fallbackError);
        } else {
          console.log(`Successfully updated embedding using fallback method for document ${doc.id}`);
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