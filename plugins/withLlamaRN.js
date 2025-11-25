// Custom wrapper for llama.rn config plugin
const { withDangerousMod, withXcodeProject, withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'llama-rn-plugin';

const withLlamaRn = (config, options = {}) => {
  const {
    enableEntitlements = true,
    entitlementsProfile = 'production',
    forceCxx20 = true,
    enableOpenCL = true
  } = options;

  // Android configuration
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // Add permissions if needed
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    
    return config;
  });

  // iOS configuration
  if (config.ios) {
    config = withXcodeProject(config, async (config) => {
      return config;
    });
  }

  return config;
};

module.exports = createRunOncePlugin(withLlamaRn, PLUGIN_NAME, '1.0.0');
