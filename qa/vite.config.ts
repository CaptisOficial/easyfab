import { mergeConfig } from "vite";
import application from "../vite.config";
export default mergeConfig(application, {
  build: {
    outDir: "src-tauri/target/results-pilot-dist",
    emptyOutDir: false,
    rollupOptions: { input: "qa/results-pilot.html" },
  },
});
