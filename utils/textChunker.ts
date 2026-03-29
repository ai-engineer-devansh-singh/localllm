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

const DEFAULT_CHUNK_SIZE = 512; // characters – larger chunks capture more context
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

        // Try to break at paragraph / sentence boundary if not at end
        if (endIndex < text.length) {
            const lastParagraph = chunkText.lastIndexOf('\n\n');
            const lastPeriod = chunkText.lastIndexOf('. ');
            const lastNewline = chunkText.lastIndexOf('\n');
            // Prefer paragraph > sentence > newline
            const breakPoint = lastParagraph > chunkSize * 0.3
                ? lastParagraph
                : Math.max(lastPeriod, lastNewline);

            if (breakPoint > chunkSize * 0.3) {
                chunkText = chunkText.substring(0, breakPoint + 1);
            }
        }

        chunks.push({
            text: chunkText.trim(),
            chunkIndex,
            startChar: startIndex,
            endChar: startIndex + chunkText.length,
        });

        if (endIndex >= text.length) {
            break;
        }

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
 * Clean and normalize text by removing unwanted whitespace and blank lines.
 * Handles output from DOCX (mammoth), XLSX, PDF OCR, and image OCR.
 */
export function cleanText(text: string): string {
    return text
        // Normalize all line endings to \n
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Replace non-breaking space and other Unicode whitespace with a regular space
        .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
        // Remove zero-width / invisible characters (common in copy-pasted / OCR text)
        .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
        // Replace tabs with a single space
        .replace(/\t/g, ' ')
        // Trim each line and collapse runs of spaces within a line to one
        .split('\n')
        .map(line => line.trim().replace(/ {2,}/g, ' '))
        // Allow at most one consecutive blank line (paragraph separator)
        .reduce<string[]>((acc, line) => {
            if (line.length > 0) {
                acc.push(line);
            } else if (acc.length > 0 && acc[acc.length - 1].length > 0) {
                acc.push(''); // first blank line after content – keep as paragraph break
            }
            // drop additional consecutive blank lines
            return acc;
        }, [])
        .join('\n')
        .trim();
}
