import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_SERVER_BASE_URL || 'http://localhost:3010';

  return {
    plugins: [react()],
    server: {
      port: 5180,
      strictPort: true,
      proxy: {
        '/admin': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});