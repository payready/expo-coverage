import tailwindcss from '@tailwindcss/vite';
import { uniwind } from 'uniwind/vite';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { rnw } from 'vite-plugin-rnw';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [
    // Reanimated (PanelUI's tabs, treemap, progress) only animates on web if its worklets are compiled,
    // and PanelUI ships as source in node_modules, so that has to be compiled too.
    rnw({ exclude: /\/node_modules\/(?!react-native|@react-native|expo|@expo|panelui-native)/, babel: { plugins: ['react-native-worklets/plugin'] } }), tailwindcss(),
    uniwind({ cssEntryFile: './src/global.css', dtsFile: './src/uniwind-types.d.ts' }),
    viteSingleFile(),
  ],
  resolve: { alias: { '@react-native/assets-registry/registry': fileURLToPath(new URL('./src/assets-registry-shim.ts', import.meta.url)) } },
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
  test: { include: ['src/**/*.test.ts'] },
});
