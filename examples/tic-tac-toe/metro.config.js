const { getDefaultConfig } = require('expo/metro-config');
const { withCoverage } = require('expo-coverage/metro');

module.exports = withCoverage(getDefaultConfig(__dirname));
