import { Message } from '@/types/chat';
import { TextChunk } from './textChunker';
import { cosineSimilarity } from './vectorStore';

// ─── Query Intent Classification ────────────────────────────────────────────

export type QueryIntent = 'summary' | 'qa' | 'extraction' | 'comparison' | 'general';

const SUMMARY_PATTERNS = /\b(summar|overview|brief|gist|outline|recap|tl;?dr|what('?s| is) (this|the|it) about|main (point|idea|theme)|key (point|takeaway|finding)|give me .* overview|high[- ]level|tell (me )?about (this|the) (doc|file|document|text|paper|article)|describe (this|the) (doc|file|document|text|paper|article)|explain (this|the) (doc|file|document|text|paper|article)|what (does|do|is) (this|the) (doc|file|document|text|paper|article))\b/i;
const EXTRACTION_PATTERNS = /\b(extract|list (all|the|every)|find (all|every)|what are (the|all)|give me (the|all)|show (all|me)|enumerate|name (all|the)|how many|mention|pick out|pull out|identify (all|the|every))\b/i;
const COMPARISON_PATTERNS = /\b(compar|differ|similar|versus|vs\.?|contrast|between .+ and|which (is|are) (better|worse|more|less)|pros and cons|advantage|disadvantage)\b/i;
const QA_PATTERNS = /\b(what|who|when|where|why|how|which|is (it|there|this)|does|did|can|could|should|would|explain|describe|tell me|define|meaning|elaborate|clarify)\b/i;

/**
 * Classify the user's query intent using lightweight regex patterns.
 * No LLM call needed — instant and efficient on mobile.
 */
export function classifyQueryIntent(query: string, hasDocument: boolean): QueryIntent {
    const q = query.toLowerCase().trim();

    if (hasDocument && SUMMARY_PATTERNS.test(q)) return 'summary';
    if (EXTRACTION_PATTERNS.test(q)) return 'extraction';
    if (COMPARISON_PATTERNS.test(q)) return 'comparison';
    if (QA_PATTERNS.test(q)) return 'qa';
    return 'general';
}

// ─── Retrieval Configuration per Intent ─────────────────────────────────────

interface RetrievalConfig {
    topK: number;
    similarityThreshold: number;
    keywordWeight: number;   // 0-1
    semanticWeight: number;  // 0-1
    includePositional: boolean; // force first/last chunks for summary
}

const RETRIEVAL_CONFIGS: Record<QueryIntent, RetrievalConfig> = {
    summary: {
        topK: 6,
        similarityThreshold: 0.05,  // Lowered from 0.1 - be permissive for summaries
        keywordWeight: 0.1,
        semanticWeight: 0.9,
        includePositional: true,
    },
    qa: {
        topK: 3,
        similarityThreshold: 0.15,  // Lowered from 0.25 - allow more diverse matches
        keywordWeight: 0.3,
        semanticWeight: 0.7,
        includePositional: false,
    },
    extraction: {
        topK: 5,
        similarityThreshold: 0.10,  // Lowered from 0.15 - be permissive for extraction
        keywordWeight: 0.4,
        semanticWeight: 0.6,
        includePositional: false,
    },
    comparison: {
        topK: 4,
        similarityThreshold: 0.15,  // Lowered from 0.2 - accept broader matches
        keywordWeight: 0.3,
        semanticWeight: 0.7,
        includePositional: false,
    },
    general: {
        topK: 3,
        similarityThreshold: 0.20,  // Lowered from 0.3 - more inclusive default
        keywordWeight: 0.3,
        semanticWeight: 0.7,
        includePositional: false,
    },
};

export function getRetrievalConfig(intent: QueryIntent): RetrievalConfig {
    return RETRIEVAL_CONFIGS[intent];
}

// ─── Keyword Scoring (BM25-lite) ────────────────────────────────────────────

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
    'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them',
    'than', 'its', 'over', 'also', 'that', 'this', 'with', 'from', 'will',
    'what', 'which', 'their', 'would', 'there', 'about', 'into', 'more',
    'could', 'should', 'being', 'were', 'other', 'just', 'your', 'when',
]);

function tokenize(text: string): string[] {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function keywordScore(query: string, chunkText: string): number {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return 0;

    const chunkTokenSet = new Set(tokenize(chunkText));
    let matches = 0;
    for (const token of queryTokens) {
        if (chunkTokenSet.has(token)) matches++;
    }
    return matches / queryTokens.length;
}

// ─── Hybrid Search ──────────────────────────────────────────────────────────

export interface ScoredChunk {
    text: string;
    chunkIndex: number;
    similarity: number;
    keywordScore: number;
    combinedScore: number;
}

/**
 * Hybrid search combining semantic (embedding) + keyword (BM25-lite) scoring.
 * Adapts retrieval strategy based on query intent.
 * 
 * GUARANTEE: Always returns at least 1 chunk if available, falling back to top-scoring
 * if similarity threshold filters everything out.
 */
export function hybridSearch(
    query: string,
    queryEmbedding: number[],
    chunks: TextChunk[],
    embeddings: number[][],
    config: RetrievalConfig
): ScoredChunk[] {
    if (chunks.length === 0) {
        console.warn('⚠️ hybridSearch: No chunks available');
        return [];
    }

    const results: ScoredChunk[] = chunks.map((chunk, idx) => {
        const semantic = cosineSimilarity(queryEmbedding, embeddings[idx]);
        const keyword = keywordScore(query, chunk.text);
        const combined = (config.semanticWeight * semantic) + (config.keywordWeight * keyword);

        return {
            text: chunk.text,
            chunkIndex: chunk.chunkIndex,
            similarity: semantic,
            keywordScore: keyword,
            combinedScore: combined,
        };
    });

    const sorted = results.sort((a, b) => b.combinedScore - a.combinedScore);
    
    console.log(`📊 Hybrid search: scoring ${results.length} chunks`);
    console.log(`   Top scores: [${sorted.slice(0, 3).map((r, i) => `${i + 1}: ${(r.combinedScore * 100).toFixed(0)}%`).join(', ')}]`);

    // For summary intent, ensure beginning and ending chunks are included
    if (config.includePositional && chunks.length > 2) {
        const topResults = sorted.slice(0, config.topK);
        const firstIdx = 0;
        const lastIdx = chunks.length - 1;

        const hasFirst = topResults.some(r => r.chunkIndex === firstIdx);
        const hasLast = topResults.some(r => r.chunkIndex === lastIdx);

        if (!hasFirst) {
            const firstChunk = results.find(r => r.chunkIndex === firstIdx)!;
            topResults.pop();
            topResults.unshift(firstChunk);
        }
        if (!hasLast && topResults.length >= 2) {
            const lastChunk = results.find(r => r.chunkIndex === lastIdx)!;
            topResults.pop();
            topResults.push(lastChunk);
        }

        // Sort by chunk order for coherent reading in summary mode
        const result = topResults.sort((a, b) => a.chunkIndex - b.chunkIndex);
        console.log(`✅ Positional retrieval: ${result.length} chunks (summary mode)`);
        return result;
    }

    // Apply threshold filtering
    let filtered = sorted.filter(r => r.combinedScore > config.similarityThreshold);
    
    console.log(`🔍 After threshold filter (>${config.similarityThreshold}): ${filtered.length} chunks`);
    
    // CRITICAL: If threshold filters out everything, return top chunk anyway
    if (filtered.length === 0 && sorted.length > 0) {
        console.warn(`⚠️ Threshold too high! Returning top chunk instead of empty result`);
        filtered = [sorted[0]];
    }
    
    const final = filtered.slice(0, config.topK);
    console.log(`✅ Final result: ${final.length} chunks returned`);
    return final;
}

// ─── Intent-Specific Prompt Templates ───────────────────────────────────────

const MAX_CONTEXT_CHARS = 3500;

const PROMPT_TEMPLATES: Record<QueryIntent, string> = {
    summary: `You are a document summarization assistant. Provide a clear, concise summary of the document based on the excerpts below.
Focus on: main topic, key points, important details, and conclusions.

Document: {docName}
User request: {query}
Excerpts:
{context}

Provide a structured summary:`,

    qa: `You are a document Q&A assistant. Answer the question using ONLY the provided context.
If the answer is not in the context, say so clearly. Do not make up information.

Context from "{docName}":
{context}

Question: {query}
Answer:`,

    extraction: `You are a data extraction assistant. Extract the requested information from the context below.
List items clearly and completely. Only include information found in the context.

Context from "{docName}":
{context}

Request: {query}
Extracted information:`,

    comparison: `You are an analysis assistant. Using the provided context, address the comparison or difference requested.
Be specific and reference what the document says.

Context from "{docName}":
{context}

Question: {query}
Analysis:`,

    general: `You are a helpful AI assistant.{contextSection}

{query}`,
};

function truncateContext(text: string): string {
    if (text.length <= MAX_CONTEXT_CHARS) return text;
    return text.substring(0, MAX_CONTEXT_CHARS) + '\n[...truncated]';
}

/**
 * Build a prompt tailored to the query intent, combining all context sources.
 * 
 * CRITICAL GUARANTEE: If document is attached, at least one chunk will be included
 * in the final prompt (either from search results or fallback context).
 */
export function buildRAGPrompt(
    intent: QueryIntent,
    query: string,
    docChunks: ScoredChunk[],
    docName?: string,
    persistentChunks?: Array<{ text: string; similarity: number }>,
    webContext?: string,
    defaultContext?: string,
): string {
    const template = PROMPT_TEMPLATES[intent];

    // For general intent without document, build flexible context
    if (intent === 'general') {
        let contextSection = '';
        if (webContext) {
            contextSection += `\n\nWeb search results:\n${webContext}`;
        }
        if (docChunks.length > 0) {
            const docCtx = docChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
            contextSection += `\n\nDocument context${docName ? ` (${docName})` : ''}:\n${docCtx}`;
        } else if (defaultContext) {
            contextSection += `\n\nDocument context${docName ? ` (${docName})` : ''}:\n${defaultContext}`;
        }
        if (persistentChunks && persistentChunks.length > 0) {
            const pCtx = persistentChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
            contextSection += `\n\nKnowledge base:\n${pCtx}`;
        }

        if (!contextSection) return query; // No context, use raw query

        // Apply a single cap to the entire context section so the query is never truncated
        contextSection = truncateContext(contextSection);

        return template
            .replace('{contextSection}', ' Use the information below to help answer.' + contextSection)
            .replace('{query}', query);
    }

    // For doc-specific intents (summary, qa, extraction, comparison)
    let context = '';
    
    // CRITICAL: Include retrieved chunks
    if (docChunks.length > 0) {
        context = docChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
        console.log(`✅ Using ${docChunks.length} retrieved chunks in prompt`);
    } else if (defaultContext && defaultContext.trim().length > 0) {
        // FALLBACK: If retrieval failed, use default context
        context = defaultContext;
        console.log(`⚠️ No retrieved chunks, using default context fallback`);
    } else {
        // LAST RESORT: If no chunks available, still build prompt but note it
        console.warn(`❌ NO CHUNKS AVAILABLE for document "${docName}"`);
    }

    if (persistentChunks && persistentChunks.length > 0) {
        const pCtx = persistentChunks.map((c, i) => `[${docChunks.length + i + 1}] ${c.text}`).join('\n\n');
        context += (context ? '\n\n' : '') + pCtx;
    }
    if (webContext) {
        context += (context ? '\n\n' : '') + `Web results:\n${webContext}`;
    }

    // Log final context stats
    console.log(`📝 Prompt context: ${context.length} chars`);
    
    return template
        .replace('{docName}', docName || 'document')
        .replace('{context}', truncateContext(context))
        .replace('{query}', query);
}

// ─── Query Embedding Cache ──────────────────────────────────────────────────

interface CacheEntry {
    embedding: number[];
    timestamp: number;
}

const queryEmbeddingCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_CACHE_SIZE = 100;

/**
 * Simple LRU cache for query embeddings to avoid regenerating same queries
 */
function cacheQueryEmbedding(query: string, embedding: number[]): void {
    // Clean old entries if cache is full
    if (queryEmbeddingCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = queryEmbeddingCache.keys().next().value;
        if (oldestKey) queryEmbeddingCache.delete(oldestKey);
    }
    
    queryEmbeddingCache.set(query, {
        embedding,
        timestamp: Date.now()
    });
}

function getCachedQueryEmbedding(query: string): number[] | null {
    const entry = queryEmbeddingCache.get(query);
    if (!entry) return null;
    
    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        queryEmbeddingCache.delete(query);
        return null;
    }
    
    return entry.embedding;
}

function clearQueryEmbeddingCache(): void {
    queryEmbeddingCache.clear();
}

// Export caching functions for use in ChatContext
export { cacheQueryEmbedding, getCachedQueryEmbedding, clearQueryEmbeddingCache };

// ─── Multi-Turn Query Enhancement ───────────────────────────────────────────

const FOLLOW_UP_PREFIXES = /^(and |also |what about |how about |tell me more|more |another |next |further |additionally )/i;
const PRONOUN_INDICATORS = /\b(it|its|this|that|these|those|they|them|the same|above|previous|mentioned)\b/i;

/**
 * Detect follow-up questions and enhance them with prior conversation context.
 * Helps the embedding model retrieve relevant chunks even when the query
 * uses implicit references from earlier turns.
 */
export function enhanceQueryWithHistory(
    query: string,
    recentMessages: Message[],
    maxHistory: number = 2
): string {
    const words = query.split(/\s+/).length;
    const isFollowUp =
        FOLLOW_UP_PREFIXES.test(query) ||
        (PRONOUN_INDICATORS.test(query) && words < 10);

    if (!isFollowUp || recentMessages.length === 0) return query;

    // Grab the most recent user messages for context
    const history = recentMessages
        .filter(m => m.role === 'user')
        .slice(-maxHistory)
        .map(m => m.content)
        .join('; ');

    if (!history) return query;

    // Prepend short history so embedding search gets better signal
    return `Context: ${history.substring(0, 200)}. Question: ${query}`;
}

// ─── Document Summary Cache ─────────────────────────────────────────────────

const summaryCache = new Map<string, string>();

/**
 * Build and cache a lightweight summary context from positional chunks.
 * Used for repeat summary queries without re-running hybrid search.
 */
export function cacheSummaryContext(docName: string, chunks: TextChunk[]): void {
    if (chunks.length === 0) return;

    const parts: string[] = [];
    parts.push(chunks[0].text); // Beginning

    if (chunks.length > 2) {
        const midIdx = Math.floor(chunks.length / 2);
        parts.push(chunks[midIdx].text); // Middle
    }

    if (chunks.length > 1) {
        parts.push(chunks[chunks.length - 1].text); // End
    }

    summaryCache.set(docName, parts.join('\n\n'));
}

export function getCachedSummaryContext(docName: string): string | null {
    return summaryCache.get(docName) || null;
}

/**
 * Build a default context string from the first N chunks of a document.
 * Used as a fallback when similarity search returns no relevant chunks,
 * so the model always has some grounding in what the document is about.
 * 
 * GUARANTEE: Returns non-empty string if any chunks exist.
 */
export function createDefaultContext(chunks: TextChunk[], numChunks: number = 2): string {
    if (chunks.length === 0) {
        console.warn('⚠️ createDefaultContext: No chunks available');
        return '';
    }
    
    const contextChunks = chunks.slice(0, Math.min(numChunks, chunks.length));
    const context = contextChunks
        .map(c => c.text)
        .join('\n\n');
    
    console.log(`📋 Created default context from ${contextChunks.length} chunks (${context.length} chars)`);
    return context;
}

export function clearSummaryCache(docName?: string): void {
    if (docName) summaryCache.delete(docName);
    else summaryCache.clear();
}
