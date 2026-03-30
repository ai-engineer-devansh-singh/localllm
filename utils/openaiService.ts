import Constants from 'expo-constants';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export const SYSTEM_PROMPT =
  'You are a helpful assistant. Use provided context from documents or web search when available and do not invent facts not supported by the context. Keep answers clear and focused.';

/**
 * Returns true when running inside Expo Go (not a standalone/bare APK build).
 * llama.rn native modules are unavailable in this environment.
 */
export function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    (Constants.executionEnvironment as string) === 'storeClient'
  );
}

/** Read the OpenAI API key from the app's extra config (sourced from .env). */
export function getOpenAIKey(): string | null {
  return Constants.expoConfig?.extra?.openaiApiKey || null;
}

/**
 * Generate a response from OpenAI with token-level streaming.
 * Falls back to non-streaming if the streaming read fails.
 */
export async function generateWithOpenAI(
  prompt: string,
  onToken: (token: string) => void,
  apiKey?: string,
  model = DEFAULT_MODEL,
): Promise<string> {
  const key = apiKey || getOpenAIKey();
  if (!key) {
    throw new Error(
      'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file and restart the dev server.'
    );
  }
  // Trim prompt to avoid exceeding context limits
  const safePrompt = prompt.substring(0, 12000);

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: safePrompt },
      ],
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    let errText = '';
    try {
      errText = await response.text();
    } catch {}
    if (response.status === 401) {
      throw new Error('Invalid OpenAI API key. Please update it in the Models tab.');
    }
    if (response.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again in a moment.');
    }
    throw new Error(`OpenAI API error (${response.status}): ${errText}`);
  }

  // Try streaming via ReadableStream (supported in RN 0.73+)
  if (response.body && typeof (response.body as any).getReader === 'function') {
    return _streamFromReader(response.body as ReadableStream<Uint8Array>, onToken);
  }

  // Fallback: non-streaming (collect full response)
  const json = await response.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';
  // Emit the whole text as a single token so callers still get streaming-style updates
  if (content) onToken(content);
  return content;
}

async function _streamFromReader(
  body: ReadableStream<Uint8Array>,
  onToken: (token: string) => void,
): Promise<string> {
  const reader = (body as any).getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep any incomplete line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return accumulated;
      try {
        const parsed = JSON.parse(data);
        const token: string | undefined = parsed.choices?.[0]?.delta?.content;
        if (token) {
          accumulated += token;
          onToken(token);
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  return accumulated;
}
