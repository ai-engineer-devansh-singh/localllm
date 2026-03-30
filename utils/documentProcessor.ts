import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { extractTextFromImage } from './ocrProcessor';
import { extractTextFromPdf } from './pdfOcrProcessor';
import { cleanText, extractTextFromFile } from './textChunker';

// Use mammoth browser version for React Native compatibility
// @ts-ignore
import * as mammoth from 'mammoth/mammoth.browser';
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

            case 'docx':
            case 'doc':
                try {
                    console.log('📄 Reading Word document...');
                    const docxData = await FileSystem.readAsStringAsync(fileUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    
                    if (!docxData || docxData.length === 0) {
                        throw new Error('Failed to read document file - file is empty');
                    }
                    
                    console.log(`   Read ${docxData.length} characters of base64 data`);

                    console.log('🔄 Converting Word document data...');
                    const binaryData = Buffer.from(docxData, 'base64');
                    console.log(`   Buffer size: ${binaryData.length} bytes`);
                    
                    // Create ArrayBuffer from Buffer
                    const arrayBuffer = binaryData.buffer.slice(
                        binaryData.byteOffset,
                        binaryData.byteOffset + binaryData.byteLength
                    );
                    
                    console.log(`   ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);

                    console.log('🔍 Extracting text from Word document...');
                    
                    // Use mammoth browser API
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    
                    if (!result) {
                        throw new Error('Mammoth returned no result');
                    }
                    
                    if (result.messages && result.messages.length > 0) {
                        console.log('   Mammoth messages:', result.messages);
                    }
                    
                    text = result.value || '';

                    console.log(`✅ Word document parsed: ${text.length} characters`);

                    if (!text || text.trim().length === 0) {
                        throw new Error('No text content found in document. The file might be empty or contain only images.');
                    }
                } catch (error) {
                    console.error('❌ DOCX processing error:', error);
                    if (error instanceof Error) {
                        throw new Error(`Failed to process Word document: ${error.message}`);
                    }
                    throw new Error('Failed to process Word document: Unknown error');
                }
                break;

            case 'xlsx':
            case 'xls':
                try {
                    console.log('📄 Reading Excel file...');
                    const xlsxData = await FileSystem.readAsStringAsync(fileUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });

                    console.log('🔍 Parsing Excel workbook...');
                    const workbook = XLSX.read(xlsxData, { type: 'base64' });
                    console.log(`   Found ${workbook.SheetNames.length} sheets`);
                    
                    const sheets = workbook.SheetNames.map(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        return XLSX.utils.sheet_to_txt(worksheet);
                    });

                    text = sheets.join('\n\n');
                    console.log(`✅ Excel parsed: ${text.length} characters`);

                    if (!text || text.trim().length === 0) {
                        throw new Error('No text content found in spreadsheet');
                    }
                } catch (error) {
                    console.error('❌ XLSX processing error:', error);
                    throw new Error(`Failed to process Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                break;

            case 'pdf':
                try {
                    console.log('📕 Converting PDF pages to images for OCR...');
                    const pdfResult = await extractTextFromPdf(fileUri);
                    text = pdfResult.text;
                    pageCount = pdfResult.pageCount;
                    console.log(`✅ PDF OCR complete: ${text.length} characters from ${pageCount} pages`);
                } catch (error) {
                    console.error('❌ PDF OCR processing error:', error);
                    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                break;

            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'heic':
            case 'webp':
                try {
                    console.log('🖼️ Extracting text from image...');
                    text = await extractTextFromImage(fileUri);
                    console.log(`✅ OCR complete: ${text.length} characters`);
                } catch (error) {
                    console.error('❌ Image OCR processing error:', error);
                    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Validate that we extracted some meaningful content
    if (cleanedText.trim().length === 0) {
        throw new Error('Document is empty or contains no readable text');
    }

    if (wordCount < 2) {
        throw new Error('Document contains too little text to process');
    }

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
    return ['txt', 'docx', 'doc', 'xlsx', 'xls', 'pdf', 'jpg', 'jpeg', 'png', 'heic', 'webp'].includes(fileType);
}

/**
 * Get list of supported file types
 */
export function getSupportedFileTypes(): string[] {
    return ['txt', 'docx', 'doc', 'xlsx', 'xls', 'pdf', 'jpg', 'jpeg', 'png', 'heic', 'webp'];
}
