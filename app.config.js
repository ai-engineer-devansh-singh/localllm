module.exports = {
  expo: {
    name: "radiq",
    slug: "radiq",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "radiq",
    userInterfaceStyle: "automatic",
    newArchEnabled: false,
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.devanshsingh2199.radiq"
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ],
      "expo-sqlite",
      [
        "expo-build-properties",
        {
          android: {
            packagingOptions: {
              pickFirst: [
                "**/libllama.so"
              ]
            }
          }
        }
      ],
      "./plugins/withLlamaRN.js"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "c6541917-91e3-4f7e-96e9-dff5c6578ce2"
      },
      googleApiKey: process.env.GOOGLE_SEARCH_API_KEY,
      googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID
    },
    owner: "devanshsingh772"
  }
};
