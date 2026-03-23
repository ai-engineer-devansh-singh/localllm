import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { Platform } from 'react-native';

export async function extractTextFromImage(imageUri: string): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('Image OCR is not supported on web builds. Use Android or iOS development builds.');
  }

  const result = await TextRecognition.recognize(imageUri, TextRecognitionScript.LATIN);
  const text = result?.text?.trim() ?? '';

  if (!text) {
    throw new Error('No readable text found in the selected image.');
  }

  return text;
}
