import { EmbeddingModel } from '@/types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { initLlama, LlamaContext } from 'llama.rn';

const EMBEDDING_MODEL_KEY = '@embedding_model';
const DOWNLOADED_EMBEDDING_MODELS_KEY = '@downloaded_embedding_models';
const MODELS_DIR = `${FileSystem.documentDirectory}models/`;

// Store loaded embedding context
let embeddingContext: LlamaContext | null = null;
let isEmbeddingModelLoading = false;

// Available embedding models
export const EMBEDDING_MODELS: EmbeddingModel[] = [
    {
        id: 'gte-small',
        name: 'GTE-Small Q4 (~25MB)',
        size: 25000000,
        downloadUrl: 'https://huggingface.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF/resolve/main/all-MiniLM-L6-v2-ggml-model-f16.gguf',
        isDownloaded: false,
        dimensions: 384,
    },
];

/**
 * Initialize models directory
 */
async function initializeModelsDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(MODELS_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
    }
}

/**
 * Get list of downloaded embedding models
 */
export async function getDownloadedEmbeddingModels(): Promise<EmbeddingModel[]> {
    try {
        const data = await AsyncStorage.getItem(DOWNLOADED_EMBEDDING_MODELS_KEY);
        if (!data) return [];

        const models = JSON.parse(data) as EmbeddingModel[];
        if (!Array.isArray(models)) return [];

        return models;
    } catch (error) {
        console.error('Error getting downloaded embedding models:', error);
        return [];
    }
}

/**
 * Check if embedding model is downloaded
 */
export async function isEmbeddingModelDownloaded(modelId: string): Promise<boolean> {
    try {
        const downloadedModels = await getDownloadedEmbeddingModels();
        return downloadedModels.some(m => m.id === modelId);
    } catch (error) {
        return false;
    }
}

/**
 * Get active embedding model
 */
export async function getEmbeddingModel(): Promise<EmbeddingModel | null> {
    try {
        const data = await AsyncStorage.getItem(EMBEDDING_MODEL_KEY);
        if (!data) return null;
        return JSON.parse(data);
    } catch (error) {
        return null;
    }
}

/**
 * Save active embedding model
 */
export async function saveEmbeddingModel(model: EmbeddingModel): Promise<void> {
    try {
        await AsyncStorage.setItem(EMBEDDING_MODEL_KEY, JSON.stringify(model));
    } catch (error) {
        throw new Error('Failed to save embedding model');
    }
}

/**
 * Download embedding model
 */
export async function downloadEmbeddingModel(
    model: EmbeddingModel,
    onProgress?: (progress: number) => void
): Promise<string> {
    try {
        await initializeModelsDir();
    } catch (error) {
        throw new Error(`Failed to initialize models directory: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!model.downloadUrl) {
        throw new Error('Invalid download URL');
    }

    const fileName = `${model.id}.gguf`;
    const fileUri = `${MODELS_DIR}${fileName}`;

    try {
        // Activate wake lock to prevent device from sleeping during download
        await activateKeepAwakeAsync('embedding-download');
        
        console.log('Starting embedding download from:', model.downloadUrl);

        // Create download resumable for progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
            model.downloadUrl,
            fileUri,
            {},
            (downloadProgress) => {
                const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
                const progress = totalBytesWritten / totalBytesExpectedToWrite;
                if (onProgress) {
                    onProgress(progress);
                }
            }
        );

        const result = await downloadResumable.downloadAsync();

        if (!result) {
            throw new Error('Download failed - no result returned');
        }

        // Verify file
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        if (!fileInfo.exists || fileInfo.size === 0) {
            throw new Error('Downloaded file is invalid');
        }

        // Save to downloaded list
        const downloadedModels = await getDownloadedEmbeddingModels();
        const updatedModel = { ...model, isDownloaded: true, localPath: result.uri };
        const filtered = downloadedModels.filter((m) => m.id !== model.id);

        await AsyncStorage.setItem(
            DOWNLOADED_EMBEDDING_MODELS_KEY,
            JSON.stringify([...filtered, updatedModel])
        );

        // If no active embedding model, set this one
        const active = await getEmbeddingModel();
        if (!active) {
            await saveEmbeddingModel(updatedModel);
        }

        return result.uri;
    } catch (error) {
        console.error('Embedding download error:', error);
        // Cleanup
        try {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
        } catch (e) { /* ignore */ }
        throw error;
    } finally {
        // Always deactivate wake lock when download completes or fails
        deactivateKeepAwake('embedding-download');
    }
}

/**
 * Delete embedding model
 */
export async function deleteEmbeddingModel(modelId: string): Promise<void> {
    try {
        const downloadedModels = await getDownloadedEmbeddingModels();
        const model = downloadedModels.find((m) => m.id === modelId);

        if (model && model.localPath) {
            await FileSystem.deleteAsync(model.localPath, { idempotent: true });

            const filtered = downloadedModels.filter((m) => m.id !== modelId);
            await AsyncStorage.setItem(DOWNLOADED_EMBEDDING_MODELS_KEY, JSON.stringify(filtered));

            const active = await getEmbeddingModel();
            if (active && active.id === modelId) {
                await AsyncStorage.removeItem(EMBEDDING_MODEL_KEY);
            }
        }
    } catch (error) {
        throw new Error(`Failed to delete embedding model: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Load the embedding model for inference
 */
export async function loadEmbeddingModel(): Promise<void> {
    if (embeddingContext) return; // Already loaded
    if (isEmbeddingModelLoading) return; // Loading in progress

    try {
        isEmbeddingModelLoading = true;
        const model = await getEmbeddingModel();

        if (!model || !model.localPath) {
            // Try to find a downloaded one
            const downloaded = await getDownloadedEmbeddingModels();
            if (downloaded.length > 0 && downloaded[0].localPath) {
                await saveEmbeddingModel(downloaded[0]);
                return loadEmbeddingModel();
            }
            throw new Error('No embedding model available');
        }

        console.log('Loading embedding model:', model.name);

        embeddingContext = await initLlama({
            model: model.localPath,
            use_mlock: false,
            n_ctx: 512,
            n_gpu_layers: 0, // CPU only for embeddings usually safer
            embedding: true, // Enable embedding mode
        });

        console.log('Embedding model loaded successfully');
    } catch (error) {
        console.error('Failed to load embedding model:', error);
        throw error;
    } finally {
        isEmbeddingModelLoading = false;
    }
}

/**
 * Generate embedding for text using local model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!embeddingContext) {
        await loadEmbeddingModel();
    }

    if (!embeddingContext) {
        throw new Error('Failed to initialize embedding context');
    }

    try {
        const result = await embeddingContext.embedding(text);
        return result.embedding;
    } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
    }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
        const embedding = await generateEmbedding(text);
        embeddings.push(embedding);
    }

    return embeddings;
}

/**
 * Release embedding model resources
 */
export async function releaseEmbeddingModel(): Promise<void> {
    if (embeddingContext) {
        await embeddingContext.release();
        embeddingContext = null;
    }
}
