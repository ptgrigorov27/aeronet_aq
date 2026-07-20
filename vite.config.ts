import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/new_web/aqforecast",
  
  server: {
    proxy: {
      '/aqi/openaq': {
        target: 'https://api.openaq.org/v3',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/aqi\/openaq/, ''),
      },
    },
  },
});
