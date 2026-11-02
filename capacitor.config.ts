import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

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
    // Bundled page shown when the live URL cannot load (cold start offline).
    errorPath: "offline.html",
    allowNavigation: [
      "it-takes-a-village.vercel.app",
      "*.convex.cloud",
      "*.convex.site",
    ],
  },
  plugins: {
    SplashScreen: {
      // Keep splash until NativeAppShell hides it after first paint.
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: "#faf8f5",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#faf8f5",
    },
    Keyboard: {
      // Shrink the WebView with the keyboard so forms can scroll above it.
      resize: KeyboardResize.Native,
    },
  },
  // Native min iOS is set in Xcode (IPHONEOS_DEPLOYMENT_TARGET = 17.0).
  // Live Activities package needs iOS 16+; project targets 17 to match Xcode.
  ios: {
    // Edge-to-edge WebView; CSS safe-top pads content under the status bar.
    contentInset: "never",
    preferredContentMode: "mobile",
    scheme: "It Takes A Village",
  },
};

export default config;
