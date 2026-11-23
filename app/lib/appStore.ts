/**
 * App Store listing URL. Update APP_STORE_ID when the app is live on the store.
 * Until then, search keeps a working funnel for caregivers on the web.
 */
export const APP_STORE_ID = ""; // e.g. "6750123456" when published

export const APP_STORE_URL = APP_STORE_ID
  ? `https://apps.apple.com/app/id${APP_STORE_ID}`
  : "https://apps.apple.com/search?term=It%20Takes%20A%20Village";

export const APP_STORE_BANNER_DISMISS_KEY = "itav_hide_get_app_banner";
