import type { CapacitorConfig } from "@capacitor/cli";

/**
 * TreeQ — Capacitor config.
 *
 * webDir = "." so Capacitor uses the project root (where index.html, dashboard.html,
 * admin.html, diagnostics.html, quick-estimate.html live) as the static web bundle.
 *
 * Server URL is the production Netlify deploy so live-reload and remote backend
 * calls keep working. Set to null when shipping a fully offline-capable build later.
 */
const config: CapacitorConfig = {
  appId: "com.treeq.app",
  appName: "TreeQ",
  webDir: ".",
  bundledWebRuntime: false,
  server: {
    // Pointing the embedded WebView at the live site means the Capacitor wrap is
    // a thin shell over treeqapp.com — same code paths in browser and native.
    // For a true offline build, set url to null and ship the static bundle.
    url: "https://treeqapp.com",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    // Pull-to-refresh inside the WebView is rarely useful for an app UI.
    scrollEnabled: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#2d5a3d",   // forest green
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Camera: {
      // Defaults are fine; surfaced here so future tweaks are obvious.
    },
    Geolocation: {},
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SpeechRecognition: {
      // @capacitor-community/speech-recognition reads from Info.plist /
      // AndroidManifest.xml; nothing to configure here beyond enabling the plugin.
    },
  },
};

export default config;
