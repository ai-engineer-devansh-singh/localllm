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
