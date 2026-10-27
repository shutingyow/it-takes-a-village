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
  const productDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "product");
  Object.defineProperty(Navigator.prototype, "product", {
    configurable: true,
    get: () => "ReactNative",
  });

  let redirect: URL | undefined;
  try {
    const result = await signIn(provider, { redirectTo });
    redirect = result.redirect;
  } finally {
    if (productDesc) {
      Object.defineProperty(Navigator.prototype, "product", productDesc);
    } else {
      delete (Navigator.prototype as { product?: string }).product;
    }
  }

  if (!redirect) {
    throw new Error("OAuth did not return a redirect URL");
  }

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: redirect.toString() });
}
