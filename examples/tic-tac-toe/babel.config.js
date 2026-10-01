module.exports = function (api) {
  api.cache.using(() => process.env.EXPO_COVERAGE);
  return { presets: ['babel-preset-expo', 'expo-coverage/babel'] };
};
