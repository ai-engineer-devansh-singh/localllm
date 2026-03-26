import { Model } from '@/types/chat';
import { initLlama, LlamaContext } from 'llama.rn';

/**
 * GGUF model inference using llama.rn
 * Based on: https://medium.com/godel-technologies/guide-to-running-ai-models-locally-on-mobile-devices-using-react-native-and-llama-rn-fcd41adbc597
 */

interface LoadedModelContext {
  model: Model;
  context: LlamaContext;
}

let loadedModel: LoadedModelContext | null = null;
let shouldStopGeneration = false;
let isLoadingModel = false; // Prevent concurrent loading attempts

/**
 * Load a model for inference with proper cleanup and error handling
 */
export async function loadModel(model: Model): Promise<void> {
  if (!model.localPath) {
    throw new Error('Model has no local path');
  }
  
  // Prevent concurrent loading
  if (isLoadingModel) {
    console.warn('⚠️ Model already loading, skipping...');
    return;
  }
  
  // If same model is already loaded, skip
  if (loadedModel?.model.id === model.id) {
    console.log('✅ Model already loaded:', model.name);
    return;
  }
  
  isLoadingModel = true;
  console.log('🔄 Loading GGUF model for inference...');
  console.log('   Model:', model.name);
  console.log('   Path:', model.localPath);
  
  try {
    // Release previous model if any - with proper cleanup
    if (loadedModel?.context) {
      console.log('   Releasing previous model...');
      try {
        await loadedModel.context.release();
      } catch (releaseError) {
        console.warn('⚠️ Error releasing previous model:', releaseError);
        // Continue anyway
      }
    }
    
    console.log('   Initializing llama context...');
    
    // Verify model path exists and is accessible
    if (!model.localPath || model.localPath.length === 0) {
      throw new Error('Invalid model path');
    }
    
    // Optimized settings for faster inference on mobile
    const context = await initLlama({
      model: model.localPath,
      use_mlock: false, // Disabled for better memory management
      n_ctx: 2048, // Increased to fit RAG context + question + response
      n_batch: 256, // Better throughput with larger context window
      n_gpu_layers: 0, // CPU only for stability
      n_threads: 2, // Conservative thread count for better stability
    });
    
    loadedModel = { model, context };
    console.log(`✅ Model ${model.name} loaded successfully`);
    console.log('   Context window:', 2048, 'tokens');
    console.log('   Threads:', 2);
    console.log('   GPU layers:', 0);
  } catch (error) {
    console.error('❌ Error loading model:', error);
    loadedModel = null; // Clear on error
    throw new Error(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    isLoadingModel = false;
  }
}

/**
 * Generate text completion with streaming support and stop capability
 * Following the Medium article's approach with proper chat formatting
 */
export async function generateText(
  prompt: string,
  onToken?: (token: string) => void
): Promise<string> {
  if (!loadedModel) {
    throw new Error('No model loaded');
  }
  
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt cannot be empty');
  }
  
  // Reset stop flag
  shouldStopGeneration = false;
  
  console.log('🤖 Starting text generation...');
  console.log('   Using model:', loadedModel.model.name);
  console.log('   Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
  
  try {
    console.log('   ⏳ Generating response with llama.rn...');
    
    // Instruct model to prioritize retrieved context when present
    const contextPrompt = "You are a helpful assistant. Use provided context from documents or web search when available and do not invent facts not supported by the context. Keep answers clear and focused.";
    // Sanitize prompt to prevent injection issues
    const safePrompt = prompt.replace(/[\r\n]+/g, ' ').trim().substring(0, 1500);
    const formattedPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${contextPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n${safePrompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`;
    
    // Stop tokens for various models
    const stopTokens = [
      '</s>',
      '<|end|>',
      '<|eot_id|>',
      '<|end_of_text|>',
      '<|im_end|>',
      '<|EOT|>',
      '<|END_OF_TURN_TOKEN|>',
      '<|end_of_turn|>',
      '<|endoftext|>',
    ];
    
    // Generate completion with optimized parameters for speed
    let tokenCount = 0;
    let accumulatedText = '';
    let lastTokenTime = Date.now();
    const MAX_GENERATION_TIME = 120000; // 2 minutes timeout
    const TOKEN_TIMEOUT = 30000; // 30 seconds without token = timeout
    
    let result;
    try {
      result = await Promise.race([
        loadedModel.context.completion(
          {
            prompt: formattedPrompt,
            n_predict: 256, // Better answer completeness for RAG queries
            temperature: 0.7,
            top_p: 0.9,
            top_k: 20,
            stop: stopTokens,
          },
          // Streaming callback - emit tokens in real-time
          (data) => {
            try {
              // Check if we should stop
              if (shouldStopGeneration) {
                console.log('   🛑 Stop requested, halting generation...');
                return;
              }
              
              // Check for timeout
              const now = Date.now();
              if (now - lastTokenTime > TOKEN_TIMEOUT) {
                console.warn('⚠️ Token timeout detected');
                return;
              }
              
              const { token } = data;
              if (token && onToken && !shouldStopGeneration) {
                tokenCount++;
                lastTokenTime = now;
                accumulatedText += token;
                if (tokenCount === 1 || tokenCount % 10 === 0) {
                  console.log(`   📝 Streaming token #${tokenCount}`);
                }
                onToken(token);
              }
            } catch (callbackError) {
              console.error('Error in callback:', callbackError);
            }
          }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Generation timeout - exceeded 2 minutes')), MAX_GENERATION_TIME)
        ),
      ]);
    } catch (timeoutError) {
      console.error('Generation error:', timeoutError);
      // Return accumulated text even if timeout
      if (accumulatedText.length > 0) {
        return accumulatedText.trim();
      }
      throw timeoutError;
    }
    
    console.log(`   🎯 Total tokens streamed: ${tokenCount}`);
    
    // If stopped, return accumulated text
    if (shouldStopGeneration) {
      console.log('   ⏹️ Generation stopped by user');
      return accumulatedText.trim();
    }
    
    const response = result.text.trim();
    
    console.log('   ✅ Response generated successfully');
    console.log('   Response length:', response.length, 'characters');
    console.log('   Tokens predicted:', result.timings?.predicted_n || 0);
    console.log('   Speed:', result.timings?.predicted_per_token_ms ? 
      `${(1000 / result.timings.predicted_per_token_ms).toFixed(2)} tokens/sec` : 'N/A');
    
    return response;
  } catch (error) {
    console.error('❌ Error generating response:', error);
    throw new Error(`Failed to generate text: ${error}`);
  }
}

/**
 * Stop the ongoing text generation
 */
export function stopGeneration(): void {
  console.log('🛑 Requesting generation stop...');
  shouldStopGeneration = true;
}

/**
 * Unload the current model
 */
export async function unloadModel(): Promise<void> {
  if (loadedModel?.context) {
    console.log('   Unloading model...');
    await loadedModel.context.release();
    loadedModel = null;
    console.log('✅ Model unloaded');
  }
}

/**
 * Check if a model is loaded
 */
export function isModelLoaded(): boolean {
  return loadedModel !== null && loadedModel.context !== null;
}

/**
 * Get currently loaded model
 */
export function getCurrentModel(): Model | null {
  return loadedModel?.model || null;
}

/**
 * Check if generation is in progress
 */
export function isGenerating(): boolean {
  return !shouldStopGeneration;
}
