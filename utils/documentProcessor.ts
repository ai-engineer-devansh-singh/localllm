import { cleanText, extractTextFromFile } from './textChunker';

/**
 * Document processor for extracting text from various file formats
 * Currently supports: TXT
 * TODO: Add support for PDF, DOCX, XLSX (requires additional native modules)
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

    switch (fileType) {
        case 'txt':
            text = await extractTextFromFile(fileUri);
            break;

        case 'pdf':
            // TODO: Implement PDF text extraction
            // Options:
            // 1. Use react-native-pdf with text extraction
            // 2. Use a cloud-based API (Google Cloud Document AI, AWS Textract)
            // 3. Convert PDF to images and use OCR
            throw new Error('PDF processing not yet implemented. Please use TXT files for now.');

        case 'docx':
        case 'doc':
            // TODO: Implement Word document processing
            // Options:
            // 1. Use mammoth library (works in Node.js, may need React Native bridge)
            // 2. Use cloud-based converter
            throw new Error('Word document processing not yet implemented. Please use TXT files for now.');

        case 'xlsx':
        case 'xls':
            // TODO: Implement Excel processing
            // Options:
            // 1. Use exceljs (may need React Native compatibility fixes)
            // 2. Use cloud-based converter
            throw new Error('Excel processing not yet implemented. Please use TXT files for now.');

        default:
            throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Clean and normalize the text
    const cleanedText = cleanText(text);

    // Calculate word count
    const wordCount = cleanedText.split(/\s+/).filter(word => word.length > 0).length;

    return {
        text: cleanedText,
        wordCount,
    };
}

/**
 * Validate that document processing is supported for file type
 */
export function isProcessingSupported(fileType: string): boolean {
    // Currently only TXT is fully supported
    return fileType === 'txt';
}

/**
 * Get list of supported file types
 */
export function getSupportedFileTypes(): string[] {
    return ['txt'];
    // TODO: Add when implemented: 'pdf', 'docx', 'doc', 'xlsx', 'xls'
}
