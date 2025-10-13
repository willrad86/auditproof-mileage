const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure Metro watches the correct node_modules and project root only
config.watchFolders = [path.resolve(__dirname, 'node_modules')];

// Tell Metro exactly where @expo/metro-runtime lives
config.resolver.extraNodeModules = {
  '@expo/metro-runtime': path.resolve(__dirname, 'node_modules/@expo/metro-runtime'),
};

module.exports = config;
