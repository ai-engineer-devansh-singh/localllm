export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface Model {
  id: string;
  name: string;
  size: number;
  downloadUrl: string;
  isDownloaded: boolean;
  isActive: boolean;
  localPath?: string;
  description?: string;
  category?: string[];
}

export interface ChatState {
  messages: Message[];
  activeModel: Model | null;
  isGenerating: boolean;
}

export interface DownloadProgress {
  modelId: string;
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
}

export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'xlsx' | 'xls' | 'doc' | 'docx' | 'txt';
  size: number;
  uploadDate: number;
  chunkCount: number;
  filePath: string;
}

export interface EmbeddingModel {
  id: string;
  name: string;
  size: number;
  downloadUrl: string;
  isDownloaded: boolean;
  dimensions: number; // 384 or 768
  localPath?: string;
}

export interface Chunk {
  id: string;
  docId: string;
  text: string;
  chunkIndex: number;
  embedding: number[];
  metadata?: Record<string, any>;
}
