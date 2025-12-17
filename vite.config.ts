import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/new_web/aqforecast",
  // Note: CORS errors in development (localhost) are expected when fetching from aeronet.gsfc.nasa.gov
  // In production (deployed to aeronet.gsfc.nasa.gov), CORS won't apply (same domain = no CORS)
  
  // ============================================================================
  // PRODUCTION NOTE: This proxy is ONLY for development (npm run dev)
  // Production builds (npm run build) do NOT use this proxy.
  // The OpenAQ API service (src/services/openaqApi.ts) automatically uses:
  // - Proxy URL (/aqi/openaq) in development (import.meta.env.DEV = true)
  // - Direct API URL (https://api.openaq.org/v3) in production
  // ============================================================================
  // Proxy OpenAQ API requests to avoid CORS issues in development
  // The proxy forwards all headers (including X-API-Key) automatically
  server: {
    proxy: {
      // Match /aqi/openaq path (Vite proxy works before base path, so /aqi/openaq should work)
      // Also match with base path just in case
      '/new_web/aqforecast/aqi/openaq': {
        target: 'https://api.openaq.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          // Remove /new_web/aqforecast/aqi/openaq, add /v3 prefix
          const newPath = path.replace(/^\/new_web\/aqforecast\/aqi\/openaq/, '/v3');
          console.log(`[Vite Proxy] Rewriting ${path} -> ${newPath}`);
          return newPath;
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Error:', err.message);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            const url = req.url || '';
            console.log(`[Vite Proxy] Proxying (base path): ${req.method} ${url}`);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            const url = req.url || '';
            console.log(`[Vite Proxy] Response (base path): ${proxyRes.statusCode} for ${url}`);
          });
        },
      },
      '/aqi/openaq': {
        target: 'https://api.openaq.org',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          // Remove /aqi/openaq prefix, add /v3 prefix (e.g., /aqi/openaq/measurements -> /v3/measurements)
          const newPath = path.replace(/^\/aqi\/openaq/, '/v3');
          console.log(`[Vite Proxy] Rewriting ${path} -> ${newPath}`);
          return newPath;
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Error:', err.message);
          });
          proxy.on('proxyReq', (_proxyReq, req, _res) => {
            const url = req.url || '';
            // The rewrite happens before proxyReq, so url is already rewritten
            // But proxyReq.url shows the original, so we need to check the actual request path
            const rewrittenPath = url.startsWith('/aqi/openaq') 
              ? url.replace(/^\/aqi\/openaq/, '/v3')
              : url;
            console.log(`[Vite Proxy] Proxying: ${req.method} ${url} -> https://api.openaq.org${rewrittenPath}`);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            const url = req.url || '';
            console.log(`[Vite Proxy] Response: ${proxyRes.statusCode} for ${url}`);
          });
        },
      },
    },
  },
});
