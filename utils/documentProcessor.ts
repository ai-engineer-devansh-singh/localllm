import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system';
import { cleanText, extractTextFromFile } from './textChunker';

// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import pdfParse from 'pdf-parse';
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
                try {
                    console.log('📄 Reading PDF file...');
                    const pdfData = await FileSystem.readAsStringAsync(fileUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    console.log(`   Read ${pdfData.length} bytes`);

                    console.log('🔄 Converting PDF data...');
                    const binaryString = Buffer.from(pdfData, 'base64');
                    console.log(`   Buffer size: ${binaryString.length} bytes`);
                    
                    console.log('🔍 Parsing PDF...');
                    const data = await pdfParse(binaryString);
                    text = data.text;
                    pageCount = data.numpages || 0;

                    console.log(`✅ PDF parsed: ${pageCount} pages, ${text.length} characters`);

                    if (!text || text.trim().length === 0) {
                        throw new Error('No text content found in PDF');
                    }
                } catch (error) {
                    console.error('❌ PDF processing error:', error);
                    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                break;

            case 'docx':
            case 'doc':
                try {
                    console.log('📄 Reading Word document...');
                    const docxData = await FileSystem.readAsStringAsync(fileUri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    console.log(`   Read ${docxData.length} bytes`);

                    console.log('🔄 Converting Word document data...');
                    const binaryString = Buffer.from(docxData, 'base64');
                    console.log(`   Buffer size: ${binaryString.length} bytes`);
                    const arrayBuffer = binaryString.buffer.slice(
                        binaryString.byteOffset,
                        binaryString.byteOffset + binaryString.byteLength
                    );

                    console.log('🔍 Extracting text from Word document...');
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    text = result.value;

                    console.log(`✅ Word document parsed: ${text.length} characters`);

                    if (!text || text.trim().length === 0) {
                        throw new Error('No text content found in document');
                    }
                } catch (error) {
                    console.error('❌ DOCX processing error:', error);
                    throw new Error(`Failed to process DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    return ['txt', 'pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(fileType);
}

/**
 * Get list of supported file types
 */
export function getSupportedFileTypes(): string[] {
    return ['txt', 'pdf', 'docx', 'doc', 'xlsx', 'xls'];
}
