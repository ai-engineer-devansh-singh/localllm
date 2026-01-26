# Google Programmable Search Engine Integration

This project has been updated to use Google's Programmable Search Engine API instead of DuckDuckGo web scraping for more reliable and accurate search results.

## Setup Instructions

### 1. Create a Google Programmable Search Engine

1. Go to [Google Programmable Search Engine](https://programmablesearchengine.google.com/)
2. Click "Add" or "Get Started"
3. Configure your search engine:
   - **Sites to search**: Choose "Search the entire web"
   - **Name**: Give it a name (e.g., "My App Search")
4. Click "Create"
5. Copy your **Search Engine ID** (cx parameter)

### 2. Get a Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Custom Search API":
   - Go to "APIs & Services" > "Library"
   - Search for "Custom Search API"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key
   - (Recommended) Restrict your API key to the Custom Search API

### 3. Configure Environment Variables

Edit the `.env` file in the project root:

```env
GOOGLE_API_KEY=your_actual_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_actual_search_engine_id_here
```

### 4. Install Dependencies

Since we removed the `cheerio-without-node-native` dependency, run:

```bash
npm install
```

or

```bash
yarn install
```

### 5. Rebuild and Start

For React Native/Expo projects, you need to restart the development server after changing environment variables:

```bash
npx expo start --clear
```

## API Quota and Pricing

- **Free Tier**: 100 queries per day
- **Paid Tier**: $5 per 1,000 queries (after free tier)
- Monitor your usage in the [Google Cloud Console](https://console.cloud.google.com/)

## Benefits of Google Programmable Search

✅ **More reliable** - API-based, not web scraping  
✅ **Better results** - Google's ranking algorithm  
✅ **Structured data** - JSON response format  
✅ **Fresher content** - Better indexing and updates  
✅ **Error handling** - Proper HTTP status codes and error messages  

## Implementation Details

The following changes were made:

1. **[utils/webSearch.ts](utils/webSearch.ts)** - Replaced DuckDuckGo scraping with Google Custom Search API
2. **[app.config.js](app.config.js)** - Added environment variable configuration
3. **[.env](.env)** - Environment variables for API credentials
4. **[package.json](package.json)** - Removed `cheerio-without-node-native` dependency
5. **Content extraction** - Simplified HTML parsing without cheerio

## Usage

The web search functionality works the same way in the UI - toggle the web search button in the chat interface to enable search results in your LLM responses.

## Troubleshooting

### "Google API credentials not configured" error
- Make sure your `.env` file has valid values
- Restart the Expo development server after changing `.env`

### "Invalid Google API key" error (403)
- Verify your API key in Google Cloud Console
- Check if the Custom Search API is enabled
- Ensure API key restrictions allow the Custom Search API

### "Google API quota exceeded" error (429)
- You've used your 100 free daily queries
- Wait until tomorrow or upgrade to paid tier
- Consider implementing client-side caching to reduce queries
