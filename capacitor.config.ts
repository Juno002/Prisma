import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.juno.prisma",
  appName: "Prisma",
  webDir: "dist/public",
  android: {
    backgroundColor: "#f4f5ef",
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
