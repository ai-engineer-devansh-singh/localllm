import { Document, Message, Model } from '@/types/chat';
import { pickDocument } from '@/utils/documentPicker';
import { processDocument } from '@/utils/documentProcessor';
import { copyDocumentToAppDir, deleteDocument as deleteDocumentFile, getDocuments, saveDocument } from '@/utils/documentStorage';
import { generateEmbedding } from '@/utils/embeddingManager';
import { getActiveModel, getDownloadedModels } from '@/utils/modelManager';
import { generateText, isModelLoaded, loadModel, stopGeneration } from '@/utils/onnxInference';
import { chunkText } from '@/utils/textChunker';
import { deleteDocumentEmbeddings, initializeVectorStore, searchSimilarChunks, storeEmbedding } from '@/utils/vectorStore';
import { cacheSearch, formatSearchResultsForContext, getCachedSearch, performWebSearch } from '@/utils/webSearch';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface ChatContextType {
  messages: Message[];
  activeModel: Model | null;
  isGenerating: boolean;
  downloadedModels: Model[];
  documents: Document[];
  isProcessingDocument: boolean;
  webSearchEnabled: boolean;
  isSearching: boolean;
  sendMessage: (content: string) => Promise<void>;
  stopGenerating: () => void;
  clearMessages: () => void;
  refreshModels: () => Promise<void>;
  setActiveModelById: (modelId: string) => Promise<void>;
  uploadDocument: () => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
  refreshDocuments: () => Promise<void>;
  toggleWebSearch: () => void;
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

  // Load active model, downloaded models, and documents on mount
  useEffect(() => {
    loadInitialData();
    loadDocuments();
    initializeVectorStore().catch(console.error);
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

  const sendMessage = async (content: string) => {
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
      } catch (error) {
        console.error('Web search failed:', error);
        setIsSearching(false);
      }
    }

    // RAG: Search for relevant context from documents and web
    let contextPrefix = '';
    
    // Add web search results to context
    if (webSearchResults && webSearchResults.results.length > 0) {
      try {
        const searchContext = formatSearchResultsForContext(webSearchResults);
        contextPrefix += searchContext + '\n\n';
        console.log('✅ Added web search context');
      } catch (error) {
        console.warn('Failed to format web search results:', error);
      }
    }
    
    // Add document context
    if (documents.length > 0) {
      try {
        console.log('🔍 Searching documents for relevant context...');
        const queryEmbedding = await generateEmbedding(content);
        const similarChunks = await searchSimilarChunks(queryEmbedding, 3);
        
        if (similarChunks.length > 0) {
          console.log(`✅ Found ${similarChunks.length} relevant chunks from documents`);
          const context = similarChunks
            .map((chunk, idx) => `[${idx + 1}] ${chunk.text}`)
            .join('\n\n');
          contextPrefix += `Context from documents:\n${context}\n\n`;
        } else {
          console.log('ℹ️ No relevant document chunks found');
        }
      } catch (error) {
        console.warn('⚠️ Failed to retrieve document context:', error);
      }
    }
    
    // Prepare final prompt
    let finalPrompt = content;
    if (contextPrefix) {
      finalPrompt = `You are a helpful AI assistant. Below is information retrieved from web searches and documents to help answer the user's question. Use this information to provide an accurate and detailed response.

${contextPrefix}
Based on the information above, please answer the following question:
${content}`;
      console.log('📝 Using context-enhanced prompt');
    } else {
      console.log('📝 Using direct prompt (no context)');
    }
    
    // Ensure model is loaded before generating
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

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
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
      console.log('   Prompt:', finalPrompt.substring(0, 200) + (finalPrompt.length > 200 ? '...' : ''));
      console.log('   Prompt length:', finalPrompt.length, 'characters');
      
      // Generate AI response with streaming
      await generateText(finalPrompt, (token: string) => {
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
    stopGeneration();
    setIsGenerating(false);
  };

  /**
   * Upload and process a document for RAG
   */
  const uploadDocument = async () => {
    try {
      setIsProcessingDocument(true);

      // Pick document
      const picked = await pickDocument();
      if (!picked) {
        setIsProcessingDocument(false);
        return;
      }

      console.log('Processing document:', picked.name);

      // Copy to app directory
      const localPath = await copyDocumentToAppDir(picked.uri, picked.name);

      // Process document (extract text)
      const processed = await processDocument(localPath, picked.type);
      console.log(`Extracted ${processed.wordCount} words from ${picked.name}`);

      // Chunk the text
      const chunks = chunkText(processed.text);
      console.log(`Created ${chunks.length} chunks`);

      // Generate embeddings and store
      console.log('Generating embeddings...');
      for (const chunk of chunks) {
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
      }

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
      console.error('Error uploading document:', error);
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
        sendMessage,
        stopGenerating,
        clearMessages,
        refreshModels,
        setActiveModelById,
        uploadDocument,
        deleteDocument,
        refreshDocuments,
        toggleWebSearch,
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
