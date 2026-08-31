import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {stylePackProxyPlugin} from './vite-plugins/stylePackProxy';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), stylePackProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@standalone': path.resolve(__dirname, 'vendor/animastage-standalone'),
        'three-stdlib-mmdparser': path.resolve(
          __dirname,
          'node_modules/three-stdlib/libs/mmdparser.js'
        ),
      },
    },
    define: {
      Ammo: 'globalThis.Ammo',
    },
    optimizeDeps: {
      // Keep FBXLoader out of the prebundle so our orphaned-curve guards apply.
      exclude: ['three/examples/jsm/loaders/FBXLoader.js'],
      // Only scan the SPA entry — ignore vendor/android/_pro_ref HTML files.
      entries: ['index.html'],
    },
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'index.html'),
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three') || id.includes('postprocessing')) {
                return 'vendor-three';
              }
              if (id.includes('@mediapipe') || id.includes('mediapipe')) {
                return 'vendor-mediapipe';
              }
              if (id.includes('@react-three') || id.includes('maath') || id.includes('zustand')) {
                return 'vendor-r3f';
              }
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
