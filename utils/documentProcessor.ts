import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { cleanText, extractTextFromFile } from './textChunker';

// @ts-ignore
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as XLSX from 'xlsx';

// Set worker for PDF.js (not needed in React Native environment usually if using legacy build, but good practice to check)
// pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

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
                const pdfData = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const pdfBuffer = Buffer.from(pdfData, 'base64');
                const pdfResult = await pdf(pdfBuffer);
                text = pdfResult.text;
                pageCount = pdfResult.numpages;
                break;

            case 'docx':
            case 'doc':
                const docxData = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const docxBuffer = Buffer.from(docxData, 'base64');
                const result = await mammoth.extractRawText({ buffer: docxBuffer });
                text = result.value;
                break;

            case 'xlsx':
            case 'xls':
                const xlsxData = await FileSystem.readAsStringAsync(fileUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                const workbook = XLSX.read(xlsxData, { type: 'base64' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                text = XLSX.utils.sheet_to_txt(worksheet);
                break;

            default:
                throw new Error(`Unsupported file type: ${fileType}`);
        }
    } catch (error) {
        console.error(`Error processing ${fileType} file:`, error);
        throw new Error(`Failed to process ${fileType} file: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Clean and normalize the text
    const cleanedText = cleanText(text);

    // Calculate word count
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
    return ['txt', 'pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(fileType);
}

/**
 * Get list of supported file types
 */
export function getSupportedFileTypes(): string[] {
    return ['txt', 'pdf', 'docx', 'doc', 'xlsx', 'xls'];
}
