import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { cleanText, extractTextFromFile } from './textChunker';

// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';

/**
 * Document processor for extracting text from various file formats
 */

export interface ProcessedDocument {
    text: string;
    pageCount?: number;
    wordCount: number;
}

/**
 * Extract text from a document based on its type
 */
export async function processDocument(
    fileUri: string,
    fileType: string
): Promise<ProcessedDocument> {
    let text = '';
    let pageCount = 0;

    try {
        switch (fileType) {
            case 'txt':
                text = await extractTextFromFile(fileUri);
                break;

            case 'pdf':
                // PDF parsing in React Native requires native modules or cloud services
                throw new Error(
                    'PDF support coming soon! For now, please use TXT, DOCX, or XLSX files.'
                );

            case 'docx':
            case 'doc':
                try {
                    const docxData = await FileSystem.readAsStringAsync(fileUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    const binaryString = Buffer.from(docxData, 'base64');
                    const arrayBuffer = binaryString.buffer.slice(
                        binaryString.byteOffset,
                        binaryString.byteOffset + binaryString.byteLength
                    );

                    const result = await mammoth.extractRawText({ arrayBuffer });
                    text = result.value;

                    if (!text || text.trim().length === 0) {
                        throw new Error('No text content found in document');
                    }
                } catch (error) {
                    console.error('DOCX processing error:', error);
                    throw new Error(`Failed to process DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                break;

            case 'xlsx':
            case 'xls':
                try {
                    const xlsxData = await FileSystem.readAsStringAsync(fileUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    const workbook = XLSX.read(xlsxData, { type: 'base64' });
                    const sheets = workbook.SheetNames.map(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        return XLSX.utils.sheet_to_txt(worksheet);
                    });

                    text = sheets.join('\n\n');

                    if (!text || text.trim().length === 0) {
                        throw new Error('No text content found in spreadsheet');
                    }
                } catch (error) {
                    console.error('XLSX processing error:', error);
                    throw new Error(`Failed to process Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                break;

            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    } catch (error) {
        console.error(`Error processing ${fileType} file:`, error);
        throw error;
    }

    const cleanedText = cleanText(text);
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;

    return {
        text: cleanedText,
        pageCount: pageCount > 0 ? pageCount : undefined,
        wordCount,
    };
}

/**
 * Validate that document processing is supported for file type
 */
export function isProcessingSupported(fileType: string): boolean {
    return ['txt', 'docx', 'doc', 'xlsx', 'xls'].includes(fileType);
}

/**
 * Get list of supported file types
 */
export function getSupportedFileTypes(): string[] {
    return ['txt', 'docx', 'doc', 'xlsx', 'xls'];
}
