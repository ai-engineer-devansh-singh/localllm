import { DownloadProgress, Model } from '@/types/chat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const MODELS_DIR = `${FileSystem.documentDirectory}models/`;
const ACTIVE_MODEL_KEY = '@active_model';
const DOWNLOADED_MODELS_KEY = '@downloaded_models';

// Available models for download
// Optimized for mobile devices with smaller, efficient models
export const AVAILABLE_MODELS: Model[] = [
  {
    id: 'tiny-llama',
    name: 'TinyLlama 1.1B (Quantized, ~637MB)',
    size: 637000000,
    downloadUrl: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    isDownloaded: false,
    isActive: false,
  },
  {
    id: 'gemma-2b',
    name: 'Gemma 2B (Quantized, ~1.6GB)',
    size: 1600000000,
    downloadUrl: 'https://huggingface.co/lmstudio-community/gemma-2b-it-GGUF/resolve/main/gemma-2b-it-Q4_K_M.gguf',
    isDownloaded: false,
    isActive: false,
  },
];

/**
 * Initialize models directory
 */
export async function initializeModelsDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
  }
}

/**
 * Download a model with progress tracking and validation
 */
export async function downloadModel(
  model: Model,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  try {
    await initializeModelsDir();
  } catch (error) {
    throw new Error(`Failed to initialize models directory: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!model.downloadUrl || model.downloadUrl.length === 0) {
    throw new Error('Invalid download URL');
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('Cannot access document directory');
  }

  const fileName = `${model.id}.gguf`;
  const fileUri = `${MODELS_DIR}${fileName}`;

  try {
    console.log('Starting download from:', model.downloadUrl);
    console.log('Saving to:', fileUri);

    // Report initial progress
    if (onProgress) {
      onProgress({
        modelId: model.id,
        progress: 0,
        totalBytes: model.size,
        downloadedBytes: 0,
      });
    }

    // Create download resumable for progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      model.downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;

        if (onProgress) {
          const progressData = {
            modelId: model.id,
            progress: totalBytesWritten / totalBytesExpectedToWrite,
            totalBytes: totalBytesExpectedToWrite,
            downloadedBytes: totalBytesWritten,
          };

          // Log every 10% progress
          const percent = Math.round(progressData.progress * 100);
          if (percent % 10 === 0) {
            console.log('Progress:', percent + '%',
              formatBytes(totalBytesWritten), 'of',
              formatBytes(totalBytesExpectedToWrite));
          }

          onProgress(progressData);
        }
      }
    );

    console.log('Download started...');
    const result = await downloadResumable.downloadAsync();

    if (!result) {
      throw new Error('Download failed - no result returned');
    }

    console.log('Download complete! File saved at:', result.uri);

    // Verify file was actually downloaded
    try {
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      if (!fileInfo.exists) {
        throw new Error('Downloaded file does not exist');
      }
      if (fileInfo.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      console.log('File verification passed. Size:', formatBytes(fileInfo.size));
    } catch (verifyError) {
      console.error('File verification failed:', verifyError);
      // Clean up the bad file
      try {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Failed to clean up bad file:', cleanupError);
      }
      throw new Error(`File verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`);
    }

    // Save to downloaded models list with proper error handling
    try {
      const downloadedModels = await getDownloadedModels();
      const updatedModel = { ...model, isDownloaded: true, localPath: result.uri };
      const filtered = downloadedModels.filter((m) => m.id !== model.id);
      await AsyncStorage.setItem(
        DOWNLOADED_MODELS_KEY,
        JSON.stringify([...filtered, updatedModel])
      );
    } catch (storageError) {
      console.error('Failed to save model metadata:', storageError);
      // Clean up the downloaded file if metadata save failed
      try {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Failed to clean up after storage error:', cleanupError);
      }
      throw new Error(`Failed to save model metadata: ${storageError instanceof Error ? storageError.message : String(storageError)}`);
    }

    return result.uri;
  } catch (error) {
    console.error('Download error:', error);

    // Try to clean up partial file
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
        console.log('Cleaned up partial download');
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    throw error;
  }
}

/**
 * Get list of downloaded models with validation
 */
export async function getDownloadedModels(): Promise<Model[]> {
  try {
    const data = await AsyncStorage.getItem(DOWNLOADED_MODELS_KEY);
    if (!data) return [];

    const models = JSON.parse(data) as Model[];
    if (!Array.isArray(models)) return [];

    return models;
  } catch (error) {
    console.error('Error getting downloaded models:', error);
    return [];
  }
}

/**
 * Get active model with validation
 */
export async function getActiveModel(): Promise<Model | null> {
  try {
    const data = await AsyncStorage.getItem(ACTIVE_MODEL_KEY);
    if (!data) return null;

    const model = JSON.parse(data) as Model;
    // Validate model has required fields
    if (model && model.id && model.localPath) {
      return model;
    }
    return null;
  } catch (error) {
    console.error('Error getting active model:', error);
    return null;
  }
}

/**
 * Set active model with validation
 */
export async function setActiveModel(model: Model): Promise<void> {
  if (!model || !model.id) {
    throw new Error('Invalid model');
  }

  try {
    await AsyncStorage.setItem(ACTIVE_MODEL_KEY, JSON.stringify(model));

    // Update downloaded models to mark this as active
    const downloadedModels = await getDownloadedModels();
    const updatedModels = downloadedModels.map((m) => ({
      ...m,
      isActive: m.id === model.id,
    }));
    await AsyncStorage.setItem(DOWNLOADED_MODELS_KEY, JSON.stringify(updatedModels));
  } catch (error) {
    throw new Error(`Failed to set active model: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a downloaded model with proper error handling
 */
export async function deleteModel(modelId: string): Promise<void> {
  if (!modelId) {
    throw new Error('Model ID cannot be empty');
  }

  try {
    const downloadedModels = await getDownloadedModels();
    const model = downloadedModels.find((m) => m.id === modelId);

    if (model && model.localPath) {
      // Delete file with proper error handling
      try {
        const fileInfo = await FileSystem.getInfoAsync(model.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(model.localPath, { idempotent: true });
          console.log('Model file deleted:', model.localPath);
        }
      } catch (fileError) {
        console.warn('Error deleting model file:', fileError);
        // Continue anyway to clean up metadata
      }

      // Remove from list
      const filtered = downloadedModels.filter((m) => m.id !== modelId);
      await AsyncStorage.setItem(DOWNLOADED_MODELS_KEY, JSON.stringify(filtered));

      // Clear active model if it's the one being deleted
      const activeModel = await getActiveModel();
      if (activeModel && activeModel.id === modelId) {
        await AsyncStorage.removeItem(ACTIVE_MODEL_KEY);
      }
    }
  } catch (error) {
    console.error('Error in deleteModel:', error);
    throw new Error(`Failed to delete model: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get total storage used by models
 */
export async function getStorageUsed(): Promise<number> {
  const downloadedModels = await getDownloadedModels();
  let totalSize = 0;

  for (const model of downloadedModels) {
    if (model.localPath) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(model.localPath);
        if (fileInfo.exists) {
          totalSize += fileInfo.size || 0;
        }
      } catch (e) {
        console.warn('Error checking file size:', e);
      }
    }
  }

  return totalSize;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
