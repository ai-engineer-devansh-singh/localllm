import * as DocumentPicker from 'expo-document-picker';

export interface PickedDocument {
    uri: string;
    name: string;
    size: number;
    mimeType: string;
    type: 'xlsx' | 'xls' | 'doc' | 'docx' | 'txt' | 'jpg' | 'jpeg' | 'png' | 'heic' | 'webp';
}

const SUPPORTED_TYPES = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' as const,
    'application/msword': 'doc' as const,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx' as const,
    'application/vnd.ms-excel': 'xls' as const,
    'text/plain': 'txt' as const,
    'image/jpeg': 'jpeg' as const,
    'image/jpg': 'jpg' as const,
    'image/png': 'png' as const,
    'image/heic': 'heic' as const,
    'image/heif': 'heic' as const,
    'image/webp': 'webp' as const,
};

const EXTENSION_TO_TYPE = {
    docx: 'docx' as const,
    doc: 'doc' as const,
    xlsx: 'xlsx' as const,
    xls: 'xls' as const,
    txt: 'txt' as const,
    jpg: 'jpg' as const,
    jpeg: 'jpeg' as const,
    png: 'png' as const,
    heic: 'heic' as const,
    heif: 'heic' as const,
    webp: 'webp' as const,
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function pickDocument(): Promise<PickedDocument | null> {
    try {
        console.log('📂 Opening document picker...');
        console.log('   Supported types:', Object.keys(SUPPORTED_TYPES));
        
        const result = await DocumentPicker.getDocumentAsync({
            type: Object.keys(SUPPORTED_TYPES),
            copyToCacheDirectory: true,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
            console.log('   Document picker cancelled');
            return null;
        }

        const file = result.assets[0];
        console.log('📄 Document selected:', {
            name: file.name,
            size: file.size,
            mimeType: file.mimeType
        });

        // Validate file size
        if (file.size && file.size > MAX_FILE_SIZE) {
            throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`);
        }

        // Map MIME type or extension to our type
        const mimeType = file.mimeType || '';
        const fromMime = SUPPORTED_TYPES[mimeType as keyof typeof SUPPORTED_TYPES];
        const extension = getFileExtension(file.name);
        const fromExtension = EXTENSION_TO_TYPE[extension as keyof typeof EXTENSION_TO_TYPE];
        const docType = fromMime || fromExtension;

        if (!docType) {
            throw new Error(
                `Unsupported file type: ${file.mimeType || file.name}. Supported types: Word, Excel, TXT, and images (JPG, PNG, HEIC, WEBP).`
            );
        }

        console.log(`✅ Document validated: ${file.name} (${docType})`);

        return {
            uri: file.uri,
            name: file.name,
            size: file.size || 0,
            mimeType,
            type: docType,
        };
    } catch (error) {
        console.error('❌ Document picker error:', error);
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
