import Constants from 'expo-constants';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface WebSearchResponse {
  results: SearchResult[];
  query: string;
  timestamp: number;
}

// Google Custom Search API configuration
const GOOGLE_API_KEY = Constants.expoConfig?.extra?.googleApiKey || '';
const GOOGLE_SEARCH_ENGINE_ID = Constants.expoConfig?.extra?.googleSearchEngineId || '';

/**
 * Search using Google Programmable Search Engine
 */
export async function searchGoogle(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  try {
    // Validate API credentials
    if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
      throw new Error('Google API credentials not configured. Please set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env file');
    }

    console.log('Searching Google for:', query);
    
    // Google Custom Search JSON API endpoint
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=${Math.min(maxResults, 10)}`;
    
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 429) {
        throw new Error('Google API quota exceeded. Please try again later or upgrade your plan.');
      } else if (response.status === 403) {
        throw new Error('Invalid Google API key or search engine ID. Please check your credentials.');
      } else if (response.status === 400) {
        throw new Error('Invalid search query or parameters.');
      }
      
      throw new Error(`Search failed: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const results: SearchResult[] = [];

    // Parse search results from Google Custom Search API response
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (results.length >= maxResults) break;

        results.push({
          title: item.title || '',
          url: item.link || '',
          snippet: item.snippet || '',
        });
      }
    }

    console.log(`Found ${results.length} search results`);
    return results;
  } catch (error) {
    console.error('Google search error:', error);
    throw new Error(`Failed to search: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch and extract main content from a URL
 * Using simple text extraction without HTML parsing
 */
export async function fetchPageContent(url: string): Promise<string> {
  try {
    console.log('Fetching content from:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    
    // Simple text extraction - remove HTML tags and clean up
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ') // Replace nbsp
      .replace(/&amp;/g, '&') // Replace amp
      .replace(/&lt;/g, '<') // Replace lt
      .replace(/&gt;/g, '>') // Replace gt
      .replace(/&quot;/g, '"') // Replace quot
      .replace(/&#\d+;/g, '') // Remove numeric entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Limit content length (max 3000 chars for context)
    if (content.length > 3000) {
      content = content.substring(0, 3000) + '...';
    }

    console.log(`Extracted ${content.length} characters from ${url}`);
    return content;
  } catch (error) {
    console.error(`Failed to fetch content from ${url}:`, error);
    return ''; // Return empty string on error, don't fail the whole search
  }
}

/**
 * Perform web search and fetch content from top results
 */
export async function performWebSearch(
  query: string,
  maxResults: number = 3,
  fetchContent: boolean = true
): Promise<WebSearchResponse> {
  try {
    // Get search results from Google
    const results = await searchGoogle(query, maxResults);

    // Optionally fetch content from each result
    if (fetchContent && results.length > 0) {
      console.log('Fetching content from top results...');
      
      // Fetch content in parallel (but limit to avoid overwhelming)
      const contentPromises = results.slice(0, Math.min(3, results.length)).map(async (result) => {
        try {
          const content = await fetchPageContent(result.url);
          return { ...result, content };
        } catch (error) {
          console.warn(`Failed to fetch ${result.url}:`, error);
          return result; // Return without content
        }
      });

      const resultsWithContent = await Promise.all(contentPromises);
      
      return {
        results: resultsWithContent,
        query,
        timestamp: Date.now(),
      };
    }

    return {
      results,
      query,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Web search failed:', error);
    throw error;
  }
}

/**
 * Format search results for LLM context
 */
export function formatSearchResultsForContext(searchResponse: WebSearchResponse): string {
  const { results, query } = searchResponse;
  
  if (results.length === 0) {
    return `No web search results found for: "${query}"`;
  }

  let context = `Web Search Results for: "${query}"\n\n`;
  
  results.forEach((result, index) => {
    context += `[${index + 1}] ${result.title}\n`;
    context += `URL: ${result.url}\n`;
    
    if (result.content) {
      context += `Content: ${result.content}\n`;
    } else if (result.snippet) {
      context += `Snippet: ${result.snippet}\n`;
    }
    
    context += '\n';
  });

  return context;
}

/**
 * Cache for search results to avoid duplicate searches
 */
const searchCache = new Map<string, WebSearchResponse>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export function getCachedSearch(query: string): WebSearchResponse | null {
  const cached = searchCache.get(query.toLowerCase());
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  
  if (cached) {
    searchCache.delete(query.toLowerCase());
  }
  
  return null;
}

export function cacheSearch(query: string, response: WebSearchResponse): void {
  searchCache.set(query.toLowerCase(), response);
}
