// createEmbeddings.mjs
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

console.log("Loading environment from:", envPath);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("Loaded .env file from parent directory");
} else {
  dotenv.config();
  console.log("Loaded .env from current directory");
}

// Get credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing required Supabase environment variables.');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('Error: Missing OpenAI API key.');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

async function createEmbeddings() {
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Get documents without embeddings
  const { data: documents, error } = await supabase
    .from('knowledge')
    .select('id, content')
    .is('embedding', null);
    
  if (error) {
    console.error('Error fetching documents:', error);
    return;
  }
    
  console.log(`Found ${documents.length} documents needing embeddings`);
  
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
      
      // Ensure text content isn't too long for the API
      if (textContent.length > 250000) {
        console.warn(`Text for document ${doc.id} is very long (${textContent.length} chars). Truncating...`);
        textContent = textContent.substring(0, 250000);
      }
      
    } catch (err) {
      console.error(`Error extracting text from document ${doc.id}:`, err);
      continue;
    }
    
    try {
      console.log(`Generating embedding for document ${doc.id}`);
      console.log(`Text length: ${textContent.length} chars`);
      console.log(`Text preview: ${textContent.substring(0, 100)}...`);
      
      // Generate embedding with OpenAI API using the official library
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textContent
      });
      
      // Extract the embedding
      const embedding = embeddingResponse.data[0].embedding;
      
      console.log(`Got embedding with ${embedding.length} dimensions`);
      
      // Convert embedding to PostgreSQL vector format
      const formattedEmbedding = `[${embedding.map(num => num.toFixed(8)).join(',')}]`;
      
      // Insert the embedding into the database
      const { error: insertError } = await supabase
        .from('knowledge')
        .update({ embedding: formattedEmbedding })
        .eq('id', doc.id);
      
      if (insertError) {
        console.error(`Error inserting embedding for document ${doc.id}:`, insertError);
      } else {
        console.log(`Successfully inserted embedding for document ${doc.id}`);
      }
      
      // Sleep for a short time to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error(`Error generating embedding for document ${doc.id}:`, err);
    }
  }
  
  console.log('Embedding creation complete');
}

// Execute the function
createEmbeddings().catch(error => {
  console.error('Unhandled error:', error);
}).finally(() => {
  console.log('Script execution complete');
});