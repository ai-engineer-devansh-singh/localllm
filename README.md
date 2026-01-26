# Radiq 🤖

A powerful, privacy-focused mobile AI assistant that runs Large Language Models (LLMs) completely on-device. Chat with AI, process documents with RAG (Retrieval Augmented Generation), and perform web searches - all without sending your data to the cloud.

## ✨ Features

### 🧠 On-Device LLM Inference
- Run state-of-the-art language models directly on your mobile device
- Multiple optimized models to choose from (1B-7B parameters)
- No internet required for inference (privacy-first)
- Powered by [llama.rn](https://github.com/mybigday/llama.rn) using GGUF format

### 📄 Document Processing & RAG
- Upload and process multiple document types (PDF, DOCX, TXT)
- Automatic text extraction and chunking
- On-device embedding generation for semantic search
- Vector store for efficient similarity search
- Context-aware responses using your documents

### 🌐 Web Search Integration
- Google Programmable Search Engine integration
- High-quality, ranked search results
- Fetch and parse web page content
- Augment AI responses with real-time web data
- Search result caching for efficiency
- Proper API error handling and quota management

### 💬 Advanced Chat Interface
- Clean, intuitive chat UI with dark theme
- Streaming responses with animated typing indicators
- Context-aware conversations
- Stop generation mid-response
- Clear chat history

### 📚 Model Management
- Download models directly in the app
- Progress tracking with download speeds
- Cancel downloads anytime
- Delete models to free up space
- Switch between models seamlessly
- Storage usage monitoring

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- iOS Simulator / Android Emulator or physical device
- Expo CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd localllm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Google Search (Optional)**
   
   To enable web search functionality:
   
   a. Create a Google Programmable Search Engine at [programmablesearchengine.google.com](https://programmablesearchengine.google.com/)
   
   b. Get an API key from [Google Cloud Console](https://console.cloud.google.com/) and enable Custom Search API
   
   c. Update `.env` file:
   ```env
   GOOGLE_SEARCH_API_KEY=your_api_key_here
   GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
   ```
   
   d. Test the integration:
   ```bash
   npm run test:search
   ```
   
   See [GOOGLE_SEARCH_SETUP.md](GOOGLE_SEARCH_SETUP.md) for detailed setup instructions.

4. **Start the development server**
   ```bash
   npx expo start
   ```

5. **Run on your platform**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go (limited functionality)
   - For full features, create a development build:
     ```bash
     npx expo run:ios
     # or
     npx expo run:android
     ```

## 📱 Platform Support

- **iOS**: ✅ Fully supported (iOS 13+)
- **Android**: ✅ Fully supported (Android 6.0+)
- **Web**: ⚠️ Limited (LLM inference not available)

## 🏗️ Architecture

### Tech Stack
- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **LLM Inference**: llama.rn with GGUF models
- **Storage**: AsyncStorage + Expo FileSystem + SQLite
- **UI**: React Native Paper with custom components
- **Animations**: React Native Reanimated

### Key Components

#### Models Tab
- Browse available LLM models
- Download with progress tracking
- Manage embedding models
- View storage usage
- Set active model

#### Chat Tab
- Send messages to active LLM
- Toggle web search enhancement
- View conversation history
- Stop generation control
- Context from uploaded documents

#### Documents Tab
- Upload documents (PDF, DOCX, TXT)
- View processed documents
- Delete documents and embeddings
- Monitor document storage

### Core Utilities

- **modelManager.ts**: Model downloads, storage, and activation
- **onnxInference.ts**: LLM loading and text generation
- **embeddingManager.ts**: Embedding model management and generation
- **documentProcessor.ts**: Extract text from various document formats
- **textChunker.ts**: Smart text chunking with overlap
- **vectorStore.ts**: SQLite-based vector storage and similarity search
- **webSearch.ts**: Google Programmable Search Engine integration with content extraction

## 🎯 Available Models

### Language Models
- **TinyLlama 1.1B** (~637MB) - Fastest, good for basic chat
- **Llama 3.2 1B** (~670MB) - Latest Llama, great balance
- **Gemma 2 2B** (~1.4GB) - Google's efficient model
- **Qwen 2.5 1.5B/3B** - Multilingual support
- **Phi 3.5 Mini** (~2.2GB) - Microsoft's powerful compact model
- **Llama 3.2 3B** (~2GB) - Enhanced reasoning
- **StableLM 2 1.6B** - Stability AI model

### Embedding Models
- **GTE-Small Q4** (~25MB) - 384-dimensional embeddings

## 📋 Configuration

### App Configuration
Edit `app.json` to customize:
- App name and bundle identifier
- Splash screen and icons
- Orientation and UI style
- Platform-specific settings

### Build Configuration
Edit `eas.json` for EAS Build settings

### TypeScript Configuration
Fully typed with TypeScript - see `tsconfig.json`

## 🔧 Development

### Project Structure
```
app/
  (tabs)/          - Tab navigation screens
  _layout.tsx      - Root layout
  index.tsx        - Entry screen
  modal.tsx        - Modal screens
components/        - Reusable UI components
  ui/              - Custom UI elements
contexts/          - React contexts (ChatContext)
utils/             - Core utility functions
types/             - TypeScript type definitions
constants/         - Theme and constants
```

### Key Scripts
```bash
npm start              # Start development server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm run web            # Run on web
npm run lint           # Lint code
npm run test:search    # Test web search integration
```

## 🛠️ Building for Production

### Using EAS Build
```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

### Local Builds
```bash
# Android APK
npx expo run:android --variant release

# iOS
npx expo run:ios --configuration Release
```

## 📦 Storage Requirements

### Minimum Free Space
- Base app: ~50MB
- Small models (1-2B): 600MB - 1.5GB
- Medium models (3-4B): 2GB - 3GB
- Documents + Embeddings: 100MB - 1GB (varies)

### Recommended
- 5GB+ free space for comfortable usage
- More for larger models (7B+)

## 🔐 Privacy & Security
LLM processing** - Model inference happens locally
- **Local storage** - All data stored on your device
- **No tracking** - No analytics or telemetry
- **Open source dependencies** - Auditable code
- **Optional web search** - Only sends queries to Google when web search is enabled

### Google Search API Usage
When web search is enabled:
- Search queries are sent to Google's Custom Search API
- Free tier: 100 queries/day
- See [Google's Privacy Policy](https://policies.google.com/privacy) for their data handling
- **Open source dependencies** - Auditable code

## ⚡ Performance Tips

1. **Model Selection**: Start with smaller models (1-2B) for faster responses
2. **Context Length**: Shorter prompts generate faster
3. **Document Size**: Chunk large documents for better performance
4. **Memory Management**: Close other apps for optimal performance
5. **Storage**: Keep sufficient free space for smooth operation

## 🐛 Troubleshooting

### Model won't load
- Ensure sufficient free storage
- Try re-downloading the model
- Check device compatibility

### Slow generation
- Use a smaller model
- Reduce context length
- Close background apps

### Document processing fails
- Check file format (PDF, DOCX, TXT supported)
- Ensure file is not corrupted
- Try smaller documents

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- [llama.rn](https://github.com/mybigday/llama.rn) - On-device LLM inference
- [Hugging Face](https://huggingface.co) - Model hosting
- [Expo](https://expo.dev) - React Native framework
- Model creators: Meta, Google, Microsoft, Alibaba, Stability AI

## 📞 Support

For issues, questions, or suggestions, please open an issue on GitHub.
