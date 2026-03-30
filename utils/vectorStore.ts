import { Chunk } from '@/types/chat';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'vector_store.db';

interface EmbeddingRow {
    id: string;
    doc_id: string;
    chunk_index: number;
    text: string;
    embedding: string;
    metadata: string | null;
    created_at: number;
}

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize vector store database
 */
export async function initializeVectorStore(): Promise<void> {
    try {
        db = await SQLite.openDatabaseAsync(DB_NAME);

        // Create embeddings table
        await db.execAsync(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_doc_id ON embeddings(doc_id);
    `);

        console.log('Vector store initialized');
    } catch (error) {
        console.error('Error initializing vector store:', error);
        throw error;
    }
}

/**
 * Store chunk with embedding
 */
export async function storeEmbedding(chunk: Chunk, docId: string): Promise<void> {
    if (!db) {
        await initializeVectorStore();
    }

    try {
        await db!.runAsync(
            `INSERT OR REPLACE INTO embeddings (id, doc_id, chunk_index, text, embedding, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                chunk.id,
                docId,
                chunk.chunkIndex,
                chunk.text,
                JSON.stringify(chunk.embedding),
                chunk.metadata ? JSON.stringify(chunk.metadata) : null,
                Date.now(),
            ]
        );
    } catch (error) {
        console.error('Error storing embedding:', error);
        throw error;
    }
}

/**
 * Search for similar chunks using cosine similarity
 * Optimized with pre-filtering by doc_id and early termination
 */
export async function searchSimilarChunks(
    queryEmbedding: number[],
    topK: number = 5,
    docId?: string
): Promise<Array<Chunk & { similarity: number }>> {
    if (!db) {
        await initializeVectorStore();
    }

    try {
        let query = 'SELECT * FROM embeddings';
        const params: any[] = [];

        if (docId) {
            query += ' WHERE doc_id = ?';
            params.push(docId);
        }

        const rows = await db!.getAllAsync<EmbeddingRow>(query, params);

        if (rows.length === 0) {
            return [];
        }

        // Pre-filter: Calculate norms once for query embedding
        const queryNorm = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
        if (queryNorm === 0) return [];

        // Calculate cosine similarity for each chunk
        const results: Array<Chunk & { similarity: number }> = [];
        let threshold = 0; // Dynamic threshold for early termination

        for (const row of rows) {
            const embedding = JSON.parse(row.embedding);
            const similarity = cosineSimilarity(queryEmbedding, embedding, queryNorm);

            // Only include if above threshold
            if (similarity >= threshold) {
                results.push({
                    id: row.id,
                    docId: row.doc_id,
                    text: row.text,
                    chunkIndex: row.chunk_index,
                    embedding,
                    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
                    similarity,
                });
            }

            // Dynamic threshold: if we have enough results, increase threshold
            if (results.length > topK * 2) {
                results.sort((a, b) => b.similarity - a.similarity);
                threshold = results[topK - 1]?.similarity || 0;
                // Keep only top K candidates
                if (results.length > topK * 2) {
                    results.splice(topK * 2);
                }
            }
        }

        // Final sort and return top K
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, topK);
    } catch (error) {
        console.error('Error searching similar chunks:', error);
        return [];
    }
}

/**
 * Delete all embeddings for a document
 */
export async function deleteDocumentEmbeddings(docId: string): Promise<void> {
    if (!db) {
        await initializeVectorStore();
    }

    try {
        await db!.runAsync('DELETE FROM embeddings WHERE doc_id = ?', [docId]);
    } catch (error) {
        console.error('Error deleting document embeddings:', error);
        throw error;
    }
}

/**
 * Get count of embeddings for a document
 */
export async function getDocumentEmbeddingCount(docId: string): Promise<number> {
    if (!db) {
        await initializeVectorStore();
    }

    try {
        const result = await db!.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM embeddings WHERE doc_id = ?',
            [docId]
        );
        return result?.count || 0;
    } catch (error) {
        console.error('Error getting embedding count:', error);
        return 0;
    }
}

/**
 * Calculate cosine similarity between two vectors
 * Optimized version with optional pre-calculated norm
 */
export function cosineSimilarity(a: number[], b: number[], aNorm?: number): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = aNorm !== undefined ? aNorm : 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        if (aNorm === undefined) normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    if (aNorm === undefined) normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (normA * normB);
}

/**
 * Get total number of embeddings
 */
export async function getTotalEmbeddingsCount(): Promise<number> {
    if (!db) {
        await initializeVectorStore();
    }

    try {
        const result = await db!.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM embeddings'
        );
        return result?.count || 0;
    } catch (error) {
        console.error('Error getting total embeddings count:', error);
        return 0;
    }
}
