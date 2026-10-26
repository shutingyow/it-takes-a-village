import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS App Store shell for It Takes A Village.
 *
 * Bundle ID: com.ittakesavillage.app
 * The WebView loads the production Vercel site so Convex realtime and
 * web deploys work without rebuilding the native binary.
 *
 * Local sim testing: temporarily set server.url to a tunnel (ngrok) or
 * http://LOCAL_IP:3000 and set cleartext: true, then run `npm run cap:sync`.
 */
const config: CapacitorConfig = {
  appId: "com.ittakesavillage.app",
  appName: "It Takes A Village",
  webDir: "www",
  server: {
    url: "https://it-takes-a-village.vercel.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#FAFAF8",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#FAFAF8",
    },
    Keyboard: {
      resize: "body",
    },
  },
  // Native min iOS is set in Xcode (IPHONEOS_DEPLOYMENT_TARGET = 17.0).
  // Live Activities package needs iOS 16+; project targets 17 to match Xcode.
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "It Takes A Village",
  },
};

export default config;
