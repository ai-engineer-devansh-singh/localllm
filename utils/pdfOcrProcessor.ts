import * as FileSystem from 'expo-file-system';
import { convert } from 'react-native-pdf-to-image';
import { extractTextFromImage } from './ocrProcessor';

export interface PdfOcrResult {
  text: string;
  pageCount: number;
}

export async function extractTextFromPdf(pdfUri: string): Promise<PdfOcrResult> {
  const converted = await convert(pdfUri);
  const imagePaths = converted?.outputFiles ?? [];

  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    throw new Error('Failed to convert PDF pages to images.');
  }

  const pageTexts: string[] = [];

  try {
    for (let pageIndex = 0; pageIndex < imagePaths.length; pageIndex++) {
      const imagePath = imagePaths[pageIndex];
      try {
        const pageText = await extractTextFromImage(imagePath, { allowEmpty: true });
        if (pageText.trim().length > 0) {
          pageTexts.push(`Page ${pageIndex + 1}:\n${pageText}`);
        } else {
          console.log(`ℹ️ PDF page ${pageIndex + 1} contains no readable text, skipping`);
        }
      } catch (pageError) {
        console.warn(`⚠️ OCR failed on PDF page ${pageIndex + 1}, skipping:`, pageError);
      }
    }
  } finally {
    await Promise.all(
      imagePaths.map((imagePath) =>
        FileSystem.deleteAsync(imagePath, { idempotent: true }).catch(() => undefined)
      )
    );
  }

  const combinedText = pageTexts.join('\n\n');

  if (!combinedText.trim()) {
    throw new Error('No readable text found in the selected PDF pages.');
  }

  return {
    text: combinedText,
    pageCount: imagePaths.length,
  };
}
