// @ts-ignore - cheerio-without-node-native doesn't have types
import * as cheerio from 'cheerio-without-node-native';

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

/**
 * Search DuckDuckGo and return results
 */
export async function searchDuckDuckGo(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  try {
    console.log('Searching DuckDuckGo for:', query);
    
    // Use DuckDuckGo HTML version for scraping
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    // Parse search results from DuckDuckGo HTML
    $('.result').each((index: number, element: any) => {
      if (index >= maxResults) return false;

      const $result = $(element);
      const $link = $result.find('.result__a');
      const $snippet = $result.find('.result__snippet');
      
      const title = $link.text().trim();
      const url = $link.attr('href') || '';
      const snippet = $snippet.text().trim();

      if (title && url) {
        results.push({
          title,
          url: url.startsWith('//') ? `https:${url}` : url,
          snippet,
        });
      }
    });

    console.log(`Found ${results.length} search results`);
    return results;
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    throw new Error(`Failed to search: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch and extract main content from a URL
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
    const $ = cheerio.load(html);

    // Remove script, style, and nav elements
    $('script, style, nav, header, footer, aside, iframe, noscript').remove();

    // Try to find main content area
    let content = '';
    
    // Priority order for content extraction
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '#content',
      'body',
    ];

    for (const selector of selectors) {
      const $element = $(selector).first();
      if ($element.length > 0) {
        content = $element.text();
        break;
      }
    }

    // Clean up the content
    content = content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n+/g, '\n') // Normalize newlines
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
    // Get search results
    const results = await searchDuckDuckGo(query, maxResults);

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
