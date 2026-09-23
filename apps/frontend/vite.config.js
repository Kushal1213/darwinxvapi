import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url));
const envDir = resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  // Keep the browser proxy aligned with the gateway configured in the root .env.
  // Vite does not automatically read an env file above the frontend workspace.
  const env = loadEnv(mode, envDir, '');
  const gatewayUrl = env.VITE_API_GATEWAY_URL || `http://localhost:${env.PORT || 3001}`;

  return {
    envDir,
    plugins: [react()],
    esbuild: {
      sourcemap: false,
    },
    optimizeDeps: {
      sourcemap: false,
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: gatewayUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: gatewayUrl,
          changeOrigin: true,
          ws: true,
        }
      }
    }
  };
});
