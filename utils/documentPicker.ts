import * as DocumentPicker from 'expo-document-picker';

export interface PickedDocument {
    uri: string;
    name: string;
    size: number;
    mimeType: string;
    type: 'pdf' | 'xlsx' | 'xls' | 'doc' | 'docx' | 'txt';
}

const SUPPORTED_TYPES = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' as const,
    'application/msword': 'doc' as const,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx' as const,
    'application/vnd.ms-excel': 'xls' as const,
    'text/plain': 'txt' as const,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function pickDocument(): Promise<PickedDocument | null> {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: Object.keys(SUPPORTED_TYPES),
            copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
            return null;
        }

        const file = result.assets[0];

        // Validate file size
        if (file.size && file.size > MAX_FILE_SIZE) {
            throw new Error('File size exceeds 10MB limit');
        }

        // Map MIME type to our type
        const docType = SUPPORTED_TYPES[file.mimeType as keyof typeof SUPPORTED_TYPES];
        if (!docType) {
            throw new Error('Unsupported file type');
        }

        return {
            uri: file.uri,
            name: file.name,
            size: file.size || 0,
            mimeType: file.mimeType || '',
            type: docType,
        };
    } catch (error) {
        console.error('Document picker error:', error);
        throw error;
    }
}

export function isSupportedFileType(mimeType: string): boolean {
    return mimeType in SUPPORTED_TYPES;
}

export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
