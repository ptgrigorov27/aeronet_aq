import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/new_web/aqforecast",
  // Note: CORS errors in development (localhost) are expected when fetching from aeronet.gsfc.nasa.gov
  // In production (deployed to aeronet.gsfc.nasa.gov), CORS won't apply (same domain = no CORS)
});
