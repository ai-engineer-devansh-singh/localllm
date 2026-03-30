import { Document, Message, Model } from '@/types/chat';
import { pickDocument } from '@/utils/documentPicker';
import { processDocument } from '@/utils/documentProcessor';
import { copyDocumentToAppDir, deleteDocument as deleteDocumentFile, getDocuments, saveDocument } from '@/utils/documentStorage';
import { generateEmbedding, getEmbeddingModel, generateEmbeddings, loadEmbeddingModel } from '@/utils/embeddingManager';
import { getActiveModel, getDownloadedModels } from '@/utils/modelManager';
import { generateText, isModelLoaded, loadModel, stopGeneration } from '@/utils/onnxInference';
import { generateWithOpenAI, getOpenAIKey, isExpoGo } from '@/utils/openaiService';

/** Virtual model entry shown when running in Expo Go (uses OpenAI API). */
const OPENAI_VIRTUAL_MODEL: Model = {
  id: 'openai-gpt4o-mini',
  name: 'GPT-4o Mini (OpenAI)',
  size: 0,
  downloadUrl: '',
  isDownloaded: true,
  isActive: true,
  description: 'Cloud inference via OpenAI API — Expo testing mode',
  category: ['cloud', 'openai'],
};
import {
  buildRAGPrompt,
  cacheSummaryContext,
  classifyQueryIntent,
  clearQueryEmbeddingCache,
  clearSummaryCache,
  createDefaultContext,
  enhanceQueryWithHistory,
  getCachedSummaryContext,
  getRetrievalConfig,
  hybridSearch,
  ScoredChunk,
  getCachedQueryEmbedding,
  cacheQueryEmbedding,
} from '@/utils/ragEngine';
import { chunkText, TextChunk } from '@/utils/textChunker';
import { deleteDocumentEmbeddings, initializeVectorStore, searchSimilarChunks, storeEmbedding } from '@/utils/vectorStore';
import { cacheSearch, formatSearchResultsForContext, getCachedSearch, performWebSearch } from '@/utils/webSearch';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface AttachedDocumentData {
  docName: string;
  chunks: TextChunk[];
  embeddings: number[][];
}

interface ChatContextType {
  messages: Message[];
  activeModel: Model | null;
  isGenerating: boolean;
  downloadedModels: Model[];
  documents: Document[];
  isProcessingDocument: boolean;
  webSearchEnabled: boolean;
  isSearching: boolean;
  hasEmbeddingModel: boolean;
  attachedDocumentData: AttachedDocumentData | null;
  isEmbeddingDocument: boolean;
  /** True when running in Expo Go — inference is handled by OpenAI API. */
  isExpoMode: boolean;
  sendMessage: (content: string, attachedDocName?: string) => Promise<void>;
  stopGenerating: () => void;
  clearMessages: () => void;
  refreshModels: () => Promise<void>;
  setActiveModelById: (modelId: string) => Promise<void>;
  uploadDocument: () => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
  refreshDocuments: () => Promise<void>;
  toggleWebSearch: () => void;
  checkEmbeddingModel: () => Promise<void>;
  attachDocument: (text: string, name: string) => Promise<void>;
  clearAttachedDocument: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeModel, setActiveModel] = useState<Model | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<Model[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasEmbeddingModel, setHasEmbeddingModel] = useState(false);
  const [attachedDocumentData, setAttachedDocumentData] = useState<AttachedDocumentData | null>(null);
  const [isEmbeddingDocument, setIsEmbeddingDocument] = useState(false);

  const isExpoMode = isExpoGo();

  // Load active model, downloaded models, and documents on mount
  useEffect(() => {
    loadInitialData();
    loadDocuments();
    checkEmbeddingModel();
    initializeVectorStore().catch(console.error);
    
    // Pre-load embedding model in background for faster first query
    console.log('🚀 Pre-loading embedding model in background...');
    loadEmbeddingModel().catch(err => {
      console.warn('⚠️ Embedding model pre-load failed (non-critical):', err);
    });
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadInitialData = async () => {
    if (isExpoMode) {
      // In Expo Go, local models cannot run — use the virtual OpenAI model.
      console.log('🌐 Expo Go detected — using OpenAI API for inference');
      setActiveModel(OPENAI_VIRTUAL_MODEL);
      setDownloadedModels([]);
      return;
    }

    try {
      const [active, downloaded] = await Promise.all([
        getActiveModel(),
        getDownloadedModels(),
      ]);
      
      if (active) setActiveModel(active);
      if (downloaded && Array.isArray(downloaded)) setDownloadedModels(downloaded);
      
      // Load the active model for inference if available
      if (active && active.localPath && active.localPath.length > 0) {
        try {
          console.log('📦 Loading active model on app startup...');
          await loadModel(active);
          console.log('✅ Active model loaded successfully');
        } catch (error) {
          console.error('⚠️ Error loading model for inference:', error);
          // Don't crash the app if model loading fails
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Set safe defaults if loading fails
      setActiveModel(null);
      setDownloadedModels([]);
    }
  };

  const refreshModels = async () => {
    try {
      const downloaded = await getDownloadedModels();
      setDownloadedModels(downloaded);
      
      const active = await getActiveModel();
      setActiveModel(active);
      
      // Load the active model for inference if it changed
      if (active && active.localPath) {
        try {
          console.log('Loading active model for inference:', active.name);
          await loadModel(active);
          console.log('Model loaded successfully');
        } catch (error) {
          console.error('Error loading model for inference:', error);
        }
      }
    } catch (error) {
      console.error('Error refreshing models:', error);
    }
  };

  const setActiveModelById = async (modelId: string) => {
    const model = downloadedModels.find((m) => m.id === modelId);
    if (model && model.localPath) {
      try {
        await loadModel(model);
        setActiveModel(model);
      } catch (error) {
        console.error('Error setting active model:', error);
        throw error;
      }
    }
  };

  /**
   * Attach a document for in-memory RAG: chunk text and generate embeddings
   * Sequential embedding generation to prevent memory crashes
   */
  const attachDocument = async (text: string, name: string): Promise<void> => {
    if (!hasEmbeddingModel) {
      throw new Error('Please download an embedding model first from the Models tab');
    }

    setIsEmbeddingDocument(true);
    try {
      console.log('📎 Attaching document for RAG:', name);
      
      // Ensure embedding model is loaded before generating embeddings
      console.log('   Verifying embedding model is loaded...');
      try {
        await loadEmbeddingModel();
        console.log('   ✅ Embedding model ready');
      } catch (error) {
        throw new Error(`Failed to load embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      const chunks = chunkText(text);
      console.log(`   Created ${chunks.length} chunks`);

      // Generate embeddings sequentially to avoid crashes
      console.log('   Starting embeddings generation (sequential mode)...');
      const embeddings = await generateEmbeddings(chunks.map(c => c.text));
      console.log(`✅ All ${chunks.length} chunk embeddings generated`);

      setAttachedDocumentData({ docName: name, chunks, embeddings });
      // Pre-cache positional chunks for quick repeat-summary queries
      cacheSummaryContext(name, chunks);
    } catch (error) {
      console.error('❌ Error attaching document:', error);
      setAttachedDocumentData(null);
      throw error;
    } finally {
      setIsEmbeddingDocument(false);
    }
  };

  /**
   * Clear the currently attached document
   */
  const clearAttachedDocument = () => {
    if (attachedDocumentData) {
      clearSummaryCache(attachedDocumentData.docName);
    }
    setAttachedDocumentData(null);
  };

  const sendMessage = async (content: string, attachedDocName?: string) => {
    if (!activeModel) {
      console.error('❌ No active model selected');
      throw new Error('No active model selected');
    }

    if (isGenerating) {
      console.warn('⚠️ Already generating, skipping...');
      return;
    }
    
    console.log('💬 Sending message...');
    console.log('   Active model:', activeModel.name);
    console.log('   Message:', content.substring(0, 50) + (content.length > 50 ? '...' : ''));

    // Perform web search if enabled
    let webSearchResults: any = null;
    let webContext = '';
    if (webSearchEnabled) {
      try {
        console.log('🌐 Web search enabled, searching...');
        setIsSearching(true);
        
        // Check cache first
        const cached = getCachedSearch(content);
        if (cached) {
          console.log('   Using cached search results');
          webSearchResults = cached;
        } else {
          webSearchResults = await performWebSearch(content, 2, true);
          cacheSearch(content, webSearchResults);
          console.log(`   Found ${webSearchResults.results.length} web results`);
        }
        
        setIsSearching(false);

        if (webSearchResults && webSearchResults.results.length > 0) {
          webContext = formatSearchResultsForContext(webSearchResults);
        }
      } catch (error) {
        console.error('Web search failed:', error);
        setIsSearching(false);
      }
    }

    // ─── Smart RAG Pipeline ────────────────────────────────────────────────
    const hasDoc = !!attachedDocumentData;
    const intent = classifyQueryIntent(content, hasDoc);
    const config = getRetrievalConfig(intent);
    console.log(`🧠 Query intent: ${intent}  (hasDoc=${hasDoc})`);

    // Enhance follow-up queries using conversation history
    const enhancedQuery = enhanceQueryWithHistory(content, messages);

    // Generate query embedding once and reuse
    let queryEmbedding: number[] | null = null;
    let docChunks: ScoredChunk[] = [];

    if (attachedDocumentData) {
      try {
        // For repeat summary queries, use the pre-cached positional context
        const cached = intent === 'summary' ? getCachedSummaryContext(attachedDocumentData.docName) : null;
        if (cached) {
          console.log('📎 Using cached summary context');
          docChunks = [{ text: cached, chunkIndex: 0, similarity: 1, keywordScore: 0, combinedScore: 1 }];
        } else {
          console.log('📎 Hybrid-searching attached document...');
          
          // Check cache first before generating embedding
          const cachedEmbedding = getCachedQueryEmbedding(enhancedQuery);
          if (cachedEmbedding) {
            console.log('   Using cached query embedding');
            queryEmbedding = cachedEmbedding;
          } else {
            queryEmbedding = await generateEmbedding(enhancedQuery);
            cacheQueryEmbedding(enhancedQuery, queryEmbedding);
          }
          
          docChunks = hybridSearch(
            enhancedQuery,
            queryEmbedding,
            attachedDocumentData.chunks,
            attachedDocumentData.embeddings,
            config,
          );
        }
        console.log(`✅ Found ${docChunks.length} relevant chunks (intent=${intent})`);
      } catch (error) {
        console.warn('⚠️ Failed to search attached document:', error);
      }
    }

    // Add persistent document context
    let persistentChunks: Array<{ text: string; similarity: number }> = [];
    if (documents.length > 0) {
      try {
        console.log('🔍 Searching persistent documents...');
        if (!queryEmbedding) {
          // Check cache for persistent search too
          const cachedEmbedding = getCachedQueryEmbedding(enhancedQuery);
          if (cachedEmbedding) {
            queryEmbedding = cachedEmbedding;
          } else {
            queryEmbedding = await generateEmbedding(enhancedQuery);
            cacheQueryEmbedding(enhancedQuery, queryEmbedding);
          }
        }
        const similarChunks = await searchSimilarChunks(queryEmbedding, 2);
        persistentChunks = similarChunks.filter((chunk) => chunk.similarity > 0.3);
        if (persistentChunks.length > 0) {
          console.log(`✅ Found ${persistentChunks.length} persistent doc chunks`);
        }
      } catch (error) {
        console.warn('⚠️ Failed to retrieve document context:', error);
      }
    }

    // Fallback context from the first 2 chunks — used when similarity search
    // yields nothing (e.g. vague opener like "tell me about this file")
    const defaultContext = attachedDocumentData
      ? createDefaultContext(attachedDocumentData.chunks)
      : undefined;

    // Build intent-specific prompt
    const finalPrompt = buildRAGPrompt(
      intent,
      content,
      docChunks,
      attachedDocumentData?.docName,
      persistentChunks,
      webContext || undefined,
      defaultContext,
    );
    console.log(`📝 Built ${intent} prompt (${finalPrompt.length} chars)`);
    
    // ✅ CHUNK DEBUG: Log exactly what's in the prompt
    if (docChunks.length > 0) {
      console.log(`✅ CHUNK CONFIRMATION: ${docChunks.length} doc chunks included in prompt`);
      docChunks.forEach((chunk, i) => {
        console.log(`   [${i + 1}] Score: ${(chunk.combinedScore * 100).toFixed(0)}% | Text: "${chunk.text.substring(0, 80)}..."`);
      });
    } else if (defaultContext && defaultContext.trim().length > 0) {
      console.log(`⚠️ No retrieval results, using default context fallback (${defaultContext.length} chars)`);
    } else {
      console.warn(`❌ WARNING: No chunks and no default context available!`);
    }
    
    // ─── Inference backend selection ──────────────────────────────────────
    if (isExpoMode) {
      // Running in Expo Go — delegate to OpenAI API
      const apiKey = getOpenAIKey();
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file and restart the dev server.'
        );
      }
    } else {
      // Running as native build — ensure local model is loaded
      if (!isModelLoaded() && activeModel.localPath && activeModel.localPath.length > 0) {
        console.log('🔄 Model not loaded, loading now...');
        try {
          await loadModel(activeModel);
          console.log('✅ Model loaded successfully');
        } catch (error) {
          console.error('❌ Failed to load model:', error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to load model: ${errorMsg}`);
        }
      } else if (!isModelLoaded()) {
        throw new Error('Model not loaded and cannot load');
      } else {
        console.log('✅ Model already loaded:', activeModel.name);
      }
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      attachedDocName: attachedDocName || (attachedDocumentData?.docName),
    };
    
    console.log('📝 Adding user message to chat');
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    // Create placeholder message for streaming with sources
    const aiMessageId = (Date.now() + 1).toString();
    const sources = webSearchResults ? webSearchResults.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
    })) : undefined;
    
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      sources,
    };
    
    setMessages((prev) => [...prev, aiMessage]);

    // Use ref to accumulate tokens for better performance
    const accumulatedContent = { current: '' };
    let updateCounter = 0;
    const UPDATE_INTERVAL = 3; // Update UI every 3 tokens for balance
    let totalTokensReceived = 0;
    let lastMessageUpdateTime = Date.now();

    try {
      console.log('🤖 Generating AI response with streaming...');
      console.log('   Backend:', isExpoMode ? 'OpenAI API' : 'Local model');
      console.log('   Prompt:', finalPrompt.substring(0, 200) + (finalPrompt.length > 200 ? '...' : ''));
      console.log('   Prompt length:', finalPrompt.length, 'characters');

      // Choose inference backend
      const apiKey = isExpoMode ? getOpenAIKey()! : null;
      const generateFn = isExpoMode
        ? (p: string, cb: (t: string) => void) => generateWithOpenAI(p, cb, apiKey!)
        : generateText;

      // Generate AI response with streaming
      await generateFn(finalPrompt, (token: string) => {
        try {
          // Log first token received
          if (totalTokensReceived === 0) {
            console.log('   📥 First token received!');
          }
          
          // Accumulate tokens
          totalTokensReceived++;
          accumulatedContent.current += token;
          updateCounter++;
          
          // Rate-limited UI update every 3 tokens or every 100ms
          const now = Date.now();
          const timeSinceLastUpdate = now - lastMessageUpdateTime;
          
          if (updateCounter >= UPDATE_INTERVAL || timeSinceLastUpdate > 100) {
            const contentToAdd = accumulatedContent.current;
            
            setMessages((prev) => {
              const updated = [...prev];
              const messageIndex = updated.findIndex((m) => m.id === aiMessageId);
              if (messageIndex !== -1) {
                updated[messageIndex] = {
                  ...updated[messageIndex],
                  content: updated[messageIndex].content + contentToAdd,
                };
                // Reset accumulator after adding to message
                accumulatedContent.current = '';
                updateCounter = 0;
              }
              return updated;
            });
            lastMessageUpdateTime = now;
          }
        } catch (tokenError) {
          console.error('Error processing token:', tokenError);
        }
      });
      
      console.log(`   ✅ Streaming complete! Total tokens: ${totalTokensReceived}`);
      
      // Check if we actually got any tokens
      if (totalTokensReceived === 0) {
        console.warn('   ⚠️ WARNING: No tokens were generated!');
      }
      
      // Add any remaining accumulated content
      if (accumulatedContent.current) {
        setMessages((prev) => {
          const updated = [...prev];
          const messageIndex = updated.findIndex((m) => m.id === aiMessageId);
          if (messageIndex !== -1) {
            updated[messageIndex] = {
              ...updated[messageIndex],
              content: updated[messageIndex].content + accumulatedContent.current,
            };
          }
          return updated;
        });
      }
      
      // Mark streaming as complete
      setMessages((prev) => {
        const updated = [...prev];
        const messageIndex = updated.findIndex((m) => m.id === aiMessageId);
        if (messageIndex !== -1) {
          updated[messageIndex] = {
            ...updated[messageIndex],
            isStreaming: false,
          };
        }
        return updated;
      });
      
      console.log('✅ AI response completed');
    } catch (error) {
      console.error('❌ Error generating response:', error);
      
      // Update message with error
      setMessages((prev) => {
        const updated = [...prev];
        const messageIndex = updated.findIndex((m) => m.id === aiMessageId);
        if (messageIndex !== -1) {
          updated[messageIndex] = {
            ...updated[messageIndex],
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            isStreaming: false,
          };
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const stopGenerating = () => {
    console.log('🛑 Stop button pressed');
    if (!isExpoMode) {
      stopGeneration();
    }
    setIsGenerating(false);
  };

  /**
   * Check if embedding model is available
   */
  const checkEmbeddingModel = async () => {
    try {
      const model = await getEmbeddingModel();
      const hasModel = model !== null && 
                      model.localPath !== undefined && 
                      model.localPath !== null && 
                      model.localPath.length > 0;
      
      console.log('🔍 Checking embedding model:', {
        modelExists: model !== null,
        hasLocalPath: model?.localPath,
        hasEmbeddingModel: hasModel
      });
      
      setHasEmbeddingModel(hasModel);
    } catch (error) {
      console.error('❌ Error checking embedding model:', error);
      setHasEmbeddingModel(false);
    }
  };

  /**
   * Upload and process a document for RAG
   */
  const uploadDocument = async () => {
    let picked: any = null;
    
    try {
      // Check if embedding model is available
      if (!hasEmbeddingModel) {
        throw new Error('Please download an embedding model first from the Models tab');
      }

      setIsProcessingDocument(true);

      // Pick document
      picked = await pickDocument();
      if (!picked) {
        setIsProcessingDocument(false);
        return;
      }

      console.log('📄 Processing document:', picked.name);
      console.log('   Type:', picked.type);
      console.log('   Size:', picked.size);

      // Copy to app directory
      console.log('📋 Copying document to app directory...');
      const localPath = await copyDocumentToAppDir(picked.uri, picked.name);
      console.log('✅ Document copied successfully');

      // Process document (extract text)
      console.log('🔍 Extracting text from document...');
      const processed = await processDocument(localPath, picked.type);
      console.log(`✅ Extracted ${processed.wordCount} words from ${picked.name}`);

      // Chunk the text
      console.log('✂️ Chunking text...');
      const chunks = chunkText(processed.text);
      console.log(`✅ Created ${chunks.length} chunks`);

      // Double-check embedding model is still available before generating embeddings
      const embeddingModel = await getEmbeddingModel();
      if (!embeddingModel || !embeddingModel.localPath) {
        throw new Error('Embedding model is no longer available. Please ensure it is downloaded.');
      }
      console.log(`✅ Using embedding model: ${embeddingModel.name}`);

      // Generate embeddings and store
      console.log('🧮 Generating embeddings...');
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`   Processing chunk ${i + 1}/${chunks.length}`);
        try {
          const embedding = await generateEmbedding(chunk.text);
          await storeEmbedding(
            {
              id: `${picked.name}_${chunk.chunkIndex}`,
              docId: picked.name,
              text: chunk.text,
              chunkIndex: chunk.chunkIndex,
              embedding,
            },
            picked.name
          );
          console.log(`   ✅ Chunk ${i + 1}/${chunks.length} embedded successfully`);
        } catch (embeddingError) {
          console.error(`   ❌ Failed to embed chunk ${i + 1}/${chunks.length}:`, embeddingError);
          throw new Error(`Failed to generate embedding for chunk ${i + 1}: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`);
        }
      }
      console.log('✅ All embeddings generated and stored');

      // Save document metadata
      const doc: Document = {
        id: picked.name,
        name: picked.name,
        type: picked.type,
        size: picked.size,
        uploadDate: Date.now(),
        chunkCount: chunks.length,
        filePath: localPath,
      };

      await saveDocument(doc);
      await loadDocuments();

      console.log('✅ Document processed successfully');
    } catch (error) {
      console.error('❌ Error uploading document:', error);
      
      // Clean up - try to delete the copied file if it exists
      if (picked && picked.name) {
        try {
          await deleteDocumentFile(picked.name);
          console.log('   🗑️ Cleaned up failed document upload');
        } catch (cleanupError) {
          console.warn('   ⚠️ Could not clean up document file:', cleanupError);
        }
      }
      
      throw error;
    } finally {
      setIsProcessingDocument(false);
    }
  };

  /**
   * Delete a document and its embeddings
   */
  const deleteDocument = async (docId: string) => {
    try {
      await deleteDocumentEmbeddings(docId);
      await deleteDocumentFile(docId);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  /**
   * Refresh documents list
   */
  const refreshDocuments = async () => {
    await loadDocuments();
  };

  const toggleWebSearch = () => {
    setWebSearchEnabled((prev) => !prev);
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        activeModel,
        isGenerating,
        downloadedModels,
        documents,
        isProcessingDocument,
        webSearchEnabled,
        isSearching,
        hasEmbeddingModel,
        attachedDocumentData,
        isEmbeddingDocument,
        isExpoMode,
        sendMessage,
        stopGenerating,
        clearMessages,
        refreshModels,
        setActiveModelById,
        uploadDocument,
        deleteDocument,
        refreshDocuments,
        toggleWebSearch,
        checkEmbeddingModel,
        attachDocument,
        clearAttachedDocument,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
