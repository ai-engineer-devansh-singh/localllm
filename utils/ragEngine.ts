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
        similarityThreshold: 0.1,
        keywordWeight: 0.1,
        semanticWeight: 0.9,
        includePositional: true,
    },
    qa: {
        topK: 3,
        similarityThreshold: 0.25,
        keywordWeight: 0.3,
        semanticWeight: 0.7,
        includePositional: false,
    },
    extraction: {
        topK: 5,
        similarityThreshold: 0.15,
        keywordWeight: 0.4,
        semanticWeight: 0.6,
        includePositional: false,
    },
    comparison: {
        topK: 4,
        similarityThreshold: 0.2,
        keywordWeight: 0.3,
        semanticWeight: 0.7,
        includePositional: false,
    },
    general: {
        topK: 3,
        similarityThreshold: 0.3,
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
 */
export function hybridSearch(
    query: string,
    queryEmbedding: number[],
    chunks: TextChunk[],
    embeddings: number[][],
    config: RetrievalConfig
): ScoredChunk[] {
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
        return topResults.sort((a, b) => a.chunkIndex - b.chunkIndex);
    }

    return sorted
        .filter(r => r.combinedScore > config.similarityThreshold)
        .slice(0, config.topK);
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
    if (docChunks.length > 0) {
        context = docChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n');
    } else if (defaultContext) {
        context = defaultContext;
    }

    if (persistentChunks && persistentChunks.length > 0) {
        const pCtx = persistentChunks.map((c, i) => `[${docChunks.length + i + 1}] ${c.text}`).join('\n\n');
        context += (context ? '\n\n' : '') + pCtx;
    }
    if (webContext) {
        context += (context ? '\n\n' : '') + `Web results:\n${webContext}`;
    }

    return template
        .replace('{docName}', docName || 'document')
        .replace('{context}', truncateContext(context))
        .replace('{query}', query);
}

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
 */
export function createDefaultContext(chunks: TextChunk[], numChunks: number = 2): string {
    return chunks
        .slice(0, numChunks)
        .map(c => c.text)
        .join('\n\n');
}

export function clearSummaryCache(docName?: string): void {
    if (docName) summaryCache.delete(docName);
    else summaryCache.clear();
}
