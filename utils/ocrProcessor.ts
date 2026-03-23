import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { Platform } from 'react-native';

interface OcrOptions {
  allowEmpty?: boolean;
}

function normalizeImageUri(input: string): string {
  const uri = input.trim();
  if (!uri) return uri;

  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }

  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }

  return uri;
}

export async function extractTextFromImage(imageUri: string, options: OcrOptions = {}): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Image OCR is not supported on web builds. Use Android or iOS development builds.');
  }

  const normalizedUri = normalizeImageUri(imageUri);
  const result = await TextRecognition.recognize(normalizedUri, TextRecognitionScript.LATIN);
  const text = result?.text?.trim() ?? '';

  if (!text && !options.allowEmpty) {
    throw new Error('No readable text found in the selected image.');
  }

  return text;
}
