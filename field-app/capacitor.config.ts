import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.segmiq.cloudfield",
  appName: "Segmiq Cloud Field",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
