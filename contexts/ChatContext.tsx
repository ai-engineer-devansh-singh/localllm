import { Message, Model } from '@/types/chat';
import { getActiveModel, getDownloadedModels } from '@/utils/modelManager';
import { generateText, isModelLoaded, loadModel, stopGeneration } from '@/utils/onnxInference';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface ChatContextType {
  messages: Message[];
  activeModel: Model | null;
  isGenerating: boolean;
  downloadedModels: Model[];
  sendMessage: (content: string) => Promise<void>;
  stopGenerating: () => void;
  clearMessages: () => void;
  refreshModels: () => Promise<void>;
  setActiveModelById: (modelId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeModel, setActiveModel] = useState<Model | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadedModels, setDownloadedModels] = useState<Model[]>([]);

  // Load active model and downloaded models on mount
  useEffect(() => {
    loadInitialData();
  }, []);

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

    // Create placeholder message for streaming
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
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
      
      // Generate AI response with streaming
      await generateText(content, (token: string) => {
        try {
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

  return (
    <ChatContext.Provider
      value={{
        messages,
        activeModel,
        isGenerating,
        downloadedModels,
        sendMessage,
        stopGenerating,
        clearMessages,
        refreshModels,
        setActiveModelById,
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
