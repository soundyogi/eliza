// analyzeEmbeddings.mjs
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

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing required Supabase environment variables.');
  process.exit(1);
}

async function analyzeEmbeddings() {
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Get all documents with embeddings
  const { data: documents, error } = await supabase
    .from('knowledge')
    .select('id, content, embedding');
    
  if (error) {
    console.error('Error fetching documents:', error);
    return;
  }
  
  console.log(`Total documents: ${documents.length}`);
  
  // Categorize embeddings by length
  const embeddingLengths = {};
  const documentsWithoutEmbeddings = documents.filter(doc => !doc.embedding);
  const documentsWithEmbeddings = documents.filter(doc => doc.embedding);
  
  console.log(`\nDocuments without embeddings: ${documentsWithoutEmbeddings.length}`);
  console.log(`Documents with embeddings: ${documentsWithEmbeddings.length}`);
  
  // Analyze documents with embeddings
  documentsWithEmbeddings.forEach(doc => {
    const length = doc.embedding.length;
    embeddingLengths[length] = (embeddingLengths[length] || 0) + 1;
  });
  
  console.log("\nEmbedding Length Distribution:");
  Object.entries(embeddingLengths).forEach(([length, count]) => {
    console.log(`  ${length} dimensions: ${count} document(s)`);
  });
  
  // Show details of documents with non-standard embedding lengths
  console.log("\nDocuments with non-1536 dimensional embeddings:");
  const nonStandardEmbeddings = documentsWithEmbeddings.filter(doc => doc.embedding.length !== 1536);
  nonStandardEmbeddings.forEach(doc => {
    console.log(`  Document ID: ${doc.id}`);
    console.log(`    Embedding length: ${doc.embedding.length}`);
    
    // Attempt to extract text preview
    let textPreview = '';
    try {
      const content = doc.content;
      if (typeof content === 'string') {
        textPreview = content;
      } else if (content.text) {
        textPreview = content.text;
      } else if (content.title && content.text) {
        textPreview = `${content.title}\n\n${content.text}`;
      } else {
        textPreview = JSON.stringify(content);
      }
      textPreview = textPreview.substring(0, 100);
    } catch (err) {
      textPreview = 'Could not extract text preview';
    }
    
    console.log(`    Content preview: ${textPreview}...`);
  });

  // Detailed embedding analysis
  console.log("\nDetailed Embedding Analysis:");
  documentsWithEmbeddings.slice(0, 5).forEach((doc, index) => {
    console.log(`\nDocument ${index + 1}:`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Embedding Length: ${doc.embedding.length}`);
    
    // Parse the embedding to get some statistics
    try {
      const parsedEmbedding = JSON.parse(doc.embedding.replace(/'/g, '"'));
      console.log(`  First 5 values: ${parsedEmbedding.slice(0, 5)}`);
      
      // Basic statistical analysis
      const mean = parsedEmbedding.reduce((a, b) => a + b, 0) / parsedEmbedding.length;
      const variance = parsedEmbedding.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / parsedEmbedding.length;
      const stdDev = Math.sqrt(variance);
      
      console.log(`  Mean: ${mean.toFixed(4)}`);
      console.log(`  Standard Deviation: ${stdDev.toFixed(4)}`);
    } catch (err) {
      console.error(`  Error parsing embedding: ${err.message}`);
    }
  });
}

// Execute the function
analyzeEmbeddings().catch(error => {
  console.error('Unhandled error:', error);
}).finally(() => {
  console.log('Script execution complete');
});