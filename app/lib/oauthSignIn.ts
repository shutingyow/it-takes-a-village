import { Capacitor } from "@capacitor/core";

/** Custom scheme registered in ios/App/App/Info.plist — must stay in sync. */
export const NATIVE_OAUTH_REDIRECT = "ittakesavillage://auth/callback";

type SignInFn = (
  provider: string,
  params?: { redirectTo?: string; code?: string }
) => Promise<{ signingIn: boolean; redirect?: URL }>;

/**
 * Convex Auth treats Capacitor as a normal web client and assigns
 * window.location to the OAuth URL. That opens Safari and leaves the user
 * on SITE_URL after login. On native we briefly look like React Native so
 * we get the redirect URL back, then open it in @capacitor/browser so the
 * custom-scheme return can hand control back to the app.
 */
export async function signInWithOAuth(
  signIn: SignInFn,
  provider: "apple" | "google"
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    await signIn(provider, { redirectTo: window.location.href });
    return;
  }

  const redirectTo = NATIVE_OAUTH_REDIRECT;

  // Convex Auth only returns the OAuth URL (instead of assigning
  // window.location) when navigator.product === "ReactNative". On iOS
  // WKWebView, `product` is often an own non-writable property — patch the
  // instance first, then the prototype, and verify before calling signIn.
  const nav = navigator as Navigator & { product?: string };
  const ownDesc = Object.getOwnPropertyDescriptor(nav, "product");
  const protoDesc = Object.getOwnPropertyDescriptor(
    Navigator.prototype,
    "product"
  );
  const restoreProduct = () => {
    try {
      if (ownDesc) {
        Object.defineProperty(nav, "product", ownDesc);
      } else {
        delete nav.product;
      }
    } catch {
      // ignore
    }
    try {
      if (protoDesc) {
        Object.defineProperty(Navigator.prototype, "product", protoDesc);
      }
    } catch {
      // ignore
    }
  };

  try {
    Object.defineProperty(nav, "product", {
      configurable: true,
      enumerable: true,
      get: () => "ReactNative",
    });
  } catch {
    // fall through to prototype patch
  }
  try {
    Object.defineProperty(Navigator.prototype, "product", {
      configurable: true,
      enumerable: true,
      get: () => "ReactNative",
    });
  } catch {
    // ignore
  }

  if (navigator.product !== "ReactNative") {
    restoreProduct();
    throw new Error(
      "Could not prepare native Google/Apple sign-in. Please update the app and try again."
    );
  }

  let redirect: URL | undefined;
  try {
    const result = await signIn(provider, { redirectTo });
    redirect = result.redirect;
  } finally {
    restoreProduct();
  }

  if (!redirect) {
    throw new Error("OAuth did not return a redirect URL");
  }

  // Keep OAuth in the system browser sheet so the main WebView never leaves
  // takesavillage.co for zealous-hound-234.convex.site.
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: redirect.toString() });
}
