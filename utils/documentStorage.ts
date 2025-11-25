import { Document } from '@/types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const DOCUMENTS_KEY = '@uploaded_documents';
const DOCUMENTS_DIR = `${FileSystem.documentDirectory}documents/`;

/**
 * Initialize documents directory
 */
export async function initializeDocumentsDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
    }
}

/**
 * Get all uploaded documents
 */
export async function getDocuments(): Promise<Document[]> {
    try {
        const data = await AsyncStorage.getItem(DOCUMENTS_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error getting documents:', error);
        return [];
    }
}

/**
 * Save document metadata
 */
export async function saveDocument(doc: Document): Promise<void> {
    try {
        const documents = await getDocuments();
        const filtered = documents.filter((d) => d.id !== doc.id);
        await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify([...filtered, doc]));
    } catch (error) {
        console.error('Error saving document:', error);
        throw new Error('Failed to save document metadata');
    }
}

/**
 * Get document by ID
 */
export async function getDocumentById(id: string): Promise<Document | null> {
    const documents = await getDocuments();
    return documents.find((d) => d.id === id) || null;
}

/**
 * Delete document and its file
 */
export async function deleteDocument(id: string): Promise<void> {
    try {
        const documents = await getDocuments();
        const doc = documents.find((d) => d.id === id);

        if (doc) {
            // Delete file if it exists
            try {
                const fileInfo = await FileSystem.getInfoAsync(doc.filePath);
                if (fileInfo.exists) {
                    await FileSystem.deleteAsync(doc.filePath, { idempotent: true });
                }
            } catch (fileError) {
                console.warn('Error deleting document file:', fileError);
            }

            // Remove from metadata
            const filtered = documents.filter((d) => d.id !== id);
            await AsyncStorage.setItem(DOCUMENTS_KEY, JSON.stringify(filtered));
        }
    } catch (error) {
        console.error('Error deleting document:', error);
        throw new Error('Failed to delete document');
    }
}

/**
 * Copy document file to app directory
 */
export async function copyDocumentToAppDir(
    sourceUri: string,
    filename: string
): Promise<string> {
    await initializeDocumentsDir();
    const destPath = `${DOCUMENTS_DIR}${Date.now()}_${filename}`;

    try {
        await FileSystem.copyAsync({
            from: sourceUri,
            to: destPath,
        });
        return destPath;
    } catch (error) {
        console.error('Error copying document:', error);
        throw new Error('Failed to copy document to app directory');
    }
}

/**
 * Get total storage used by documents
 */
export async function getDocumentsStorageUsed(): Promise<number> {
    const documents = await getDocuments();
    let totalSize = 0;

    for (const doc of documents) {
        try {
            const fileInfo = await FileSystem.getInfoAsync(doc.filePath);
            if (fileInfo.exists) {
                totalSize += fileInfo.size || 0;
            }
        } catch (e) {
            console.warn('Error checking document size:', e);
        }
    }

    return totalSize;
}
