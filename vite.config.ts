import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const googleSheetUrl = process.env.VITE_GOOGLE_SHEET_URL || env.VITE_GOOGLE_SHEET_URL || "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";
  
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_GOOGLE_SHEET_URL': JSON.stringify(googleSheetUrl),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 3000,
    },
  };
});
