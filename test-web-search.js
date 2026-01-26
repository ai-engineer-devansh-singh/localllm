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
    if (data.items && data.items[0]) {
      console.log('4️⃣  Testing Content Extraction...');
      const firstUrl = data.items[0].link;
      console.log(`   Fetching content from: ${firstUrl}`);
      
      try {
        const contentResponse = await fetch(firstUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (contentResponse.ok) {
          const html = await contentResponse.text();
          const content = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 500);
          
          console.log(`   ✅ Content extracted: ${content.length} characters`);
          console.log(`   Preview: ${content.substring(0, 150)}...`);
        } else {
          console.log(`   ⚠️  Failed to fetch content: ${contentResponse.status}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Content fetch error: ${error.message}`);
      }
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
    await testSearch('React Native development', 3);
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
})();
