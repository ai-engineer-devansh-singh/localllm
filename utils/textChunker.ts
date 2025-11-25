import * as FileSystem from 'expo-file-system';

/**
 * Simple text chunking utility for RAG
 * Splits text into overlapping chunks for better context retrieval
 */

export interface TextChunk {
    text: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
}

const DEFAULT_CHUNK_SIZE = 500; // characters
const DEFAULT_OVERLAP = 50; // characters

/**
 * Split text into chunks with overlap
 */
export function chunkText(
    text: string,
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    overlap: number = DEFAULT_OVERLAP
): TextChunk[] {
    if (!text || text.length === 0) {
        return [];
    }

    const chunks: TextChunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
        const endIndex = Math.min(startIndex + chunkSize, text.length);
        let chunkText = text.substring(startIndex, endIndex);

        // Try to break at sentence boundary if not at end
        if (endIndex < text.length) {
            const lastPeriod = chunkText.lastIndexOf('. ');
            const lastNewline = chunkText.lastIndexOf('\n');
            const breakPoint = Math.max(lastPeriod, lastNewline);

            if (breakPoint > chunkSize * 0.5) {
                // Only break if we're past halfway
                chunkText = chunkText.substring(0, breakPoint + 1);
            }
        }

        chunks.push({
            text: chunkText.trim(),
            chunkIndex,
            startChar: startIndex,
            endChar: startIndex + chunkText.length,
        });

        // Move start index forward, accounting for overlap
        startIndex += chunkText.length - overlap;
        chunkIndex++;
    }

    return chunks;
}

/**
 * Extract text from a plain text file
 */
export async function extractTextFromFile(fileUri: string): Promise<string> {
    try {
        const content = await FileSystem.readAsStringAsync(fileUri);
        return content;
    } catch (error) {
        console.error('Error reading file:', error);
        throw new Error('Failed to read file');
    }
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
    return text
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
        .replace(/\t/g, ' ') // Replace tabs with spaces
        .replace(/  +/g, ' ') // Replace multiple spaces with single space
        .trim();
}
