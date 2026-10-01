'use strict';

const { withAndroidManifest, withInfoPlist, createRunOncePlugin } = require('expo/config-plugins');

/**
 * Lets coverage builds talk to the collector over plain HTTP on the local network.
 * Applies only when EXPO_COVERAGE=1, so production config is never loosened.
 */
const withExpoCoverage = (config) => {
  if (process.env.EXPO_COVERAGE !== '1') return config;
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application && c.modResults.manifest.application[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return c;
  });
  return withInfoPlist(config, (c) => {
    c.modResults.NSAppTransportSecurity = { ...(c.modResults.NSAppTransportSecurity || {}), NSAllowsLocalNetworking: true };
    return c;
  });
};

module.exports = createRunOncePlugin(withExpoCoverage, 'expo-coverage', '0.1.0');
