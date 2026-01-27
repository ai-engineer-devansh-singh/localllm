/**
 * Test script for Google Programmable Search Engine integration
 * Run with: node test-web-search.js
 */

// Load environment variables
require('dotenv').config();

// Simple test without React Native dependencies
const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

console.log('\n🔍 Testing Google Programmable Search Engine Integration\n');
console.log('=' .repeat(60));

// Check if credentials are configured
console.log('\n1️⃣  Checking Configuration...');
console.log('   GOOGLE_API_KEY:', GOOGLE_API_KEY ? `${GOOGLE_API_KEY.substring(0, 10)}...` : '❌ NOT SET');
console.log('   GOOGLE_SEARCH_ENGINE_ID:', GOOGLE_SEARCH_ENGINE_ID ? `${GOOGLE_SEARCH_ENGINE_ID.substring(0, 10)}...` : '❌ NOT SET');

if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
  console.log('\n❌ ERROR: API credentials not configured!');
  console.log('   Please update your .env file with valid credentials.');
  console.log('   See GOOGLE_SEARCH_SETUP.md for instructions.\n');
  process.exit(1);
}

// Test search function
async function testSearch(query, maxResults = 3) {
  try {
    console.log(`\n2️⃣  Searching for: "${query}"`);
    console.log('   Making API request...');
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=${maxResults}`;
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        throw new Error('❌ Google API quota exceeded. Please try again later or upgrade your plan.');
      } else if (response.status === 403) {
        throw new Error('❌ Invalid Google API key or search engine ID. Please check your credentials.');
      } else if (response.status === 400) {
        throw new Error('❌ Invalid search query or parameters.');
      }
      
      throw new Error(`Search failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    console.log('   ✅ API request successful!');
    console.log(`   Found ${data.items?.length || 0} results\n`);

    if (data.items && Array.isArray(data.items)) {
      console.log('3️⃣  Search Results:\n');
      data.items.forEach((item, index) => {
        console.log(`   [${index + 1}] ${item.title}`);
        console.log(`       URL: ${item.link}`);
        console.log(`       Snippet: ${item.snippet?.substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('   ⚠️  No results found');
    }

    // Test content fetching from first result
    const resultsWithContent = [];
    if (data.items && data.items.length > 0) {
      console.log('4️⃣  Testing Content Extraction from Top Results...');
      
      for (let i = 0; i < Math.min(3, data.items.length); i++) {
        const item = data.items[i];
        console.log(`\n   [${i + 1}] Fetching: ${item.link}`);
        
        try {
          const contentResponse = await fetch(item.link, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(10000),
          });

          if (contentResponse.ok) {
            const html = await contentResponse.text();
            let content = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#\d+;/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (content.length > 3000) {
              content = content.substring(0, 3000) + '...';
            }
            
            resultsWithContent.push({
              title: item.title,
              url: item.link,
              snippet: item.snippet,
              content: content
            });
            
            console.log(`       ✅ Extracted ${content.length} characters`);
          } else {
            console.log(`       ⚠️  Failed: ${contentResponse.status}`);
            resultsWithContent.push({
              title: item.title,
              url: item.link,
              snippet: item.snippet,
              content: ''
            });
          }
        } catch (error) {
          console.log(`       ⚠️  Error: ${error.message}`);
          resultsWithContent.push({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
            content: ''
          });
        }
      }
      
      // Format as it would be sent to the AI
      console.log('\n5️⃣  FORMATTED CONTEXT (What the AI receives):\n');
      console.log('=' .repeat(60));
      
      let contextText = `Web Search Results for: "${query}"\n\n`;
      resultsWithContent.forEach((result, index) => {
        contextText += `[${index + 1}] ${result.title}\n`;
        contextText += `URL: ${result.url}\n`;
        
        if (result.content) {
          contextText += `Content: ${result.content}\n`;
        } else if (result.snippet) {
          contextText += `Snippet: ${result.snippet}\n`;
        }
        contextText += '\n';
      });
      
      console.log(contextText);
      console.log('=' .repeat(60));
      
      // Show what the full prompt would look like
      const userQuestion = query;
      const fullPrompt = `You are a helpful AI assistant. Below is information retrieved from web searches and documents to help answer the user's question. Use this information to provide an accurate and detailed response.

${contextText}
Based on the information above, please answer the following question:
${userQuestion}`;
      
      console.log('\n6️⃣  FULL PROMPT (What the AI model receives):\n');
      console.log('=' .repeat(60));
      console.log(fullPrompt);
      console.log('=' .repeat(60));
      console.log(`\n   Total prompt length: ${fullPrompt.length} characters`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('✅ TEST PASSED - Web search integration is working!');
    console.log('=' .repeat(60) + '\n');
    
    return data;
  } catch (error) {
    console.log('\n' + '=' .repeat(60));
    console.log('❌ TEST FAILED');
    console.log(`   Error: ${error.message}`);
    console.log('=' .repeat(60) + '\n');
    throw error;
  }
}

// Run the test
(async () => {
  try {
    await testSearch('what is the weather in dublin', 2);
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
})();
