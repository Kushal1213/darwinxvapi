import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url));
const envDir = process.env.VEYRA_ENV_FILE ? dirname(process.env.VEYRA_ENV_FILE) : resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  // Keep the browser proxy aligned with the gateway configured in the root .env.
  // Vite does not automatically read an env file above the frontend workspace.
  const env = loadEnv(mode, envDir, '');
  const gatewayUrl = env.VITE_API_GATEWAY_URL || `http://localhost:${env.PORT || 3001}`;

  return {
    envDir,
    ...(process.env.VEYRA_TENANT_ID && { cacheDir: resolve(__dirname, '../../node_modules/.vite-tenants', createHash('sha256').update(envDir).digest('hex')) }),
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      sourcemap: false,
    },
    server: {
      port: 3000,
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', '**/knowledge-base/**',
          ...(process.env.VEYRA_TENANT_ID ? [envDir.replaceAll('\\', '/') + '/**'] : [])],
      },
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
