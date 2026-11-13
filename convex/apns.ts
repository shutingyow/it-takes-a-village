"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Push Live Activity + silent wakes when a milk feed changes.
 * No-ops if APNs env is not configured (web-only / pre-key setups).
 *
 * Env (Convex dashboard):
 * - APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC (com.ittakesavillage.app)
 * - APNS_PRIVATE_KEY (PKCS8 .p8 contents, newlines OK as \n)
 * - APNS_PRODUCTION = "true" for App Store / TestFlight production APNs
 */

type ApnsConfig = {
  keyId: string;
  teamId: string;
  topic: string;
  privateKeyPem: string;
  production: boolean;
};

function readApnsConfig(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const topic = process.env.APNS_TOPIC?.trim() ?? "com.ittakesavillage.app";
  const privateKeyPem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n")?.trim();
  if (!keyId || !teamId || !privateKeyPem) return null;
  return {
    keyId,
    teamId,
    topic,
    privateKeyPem,
    production: process.env.APNS_PRODUCTION === "true",
  };
}

function base64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createApnsJwt(config: ApnsConfig): Promise<string> {
  const header = base64url(
    JSON.stringify({ alg: "ES256", kid: config.keyId })
  );
  const now = Math.floor(Date.now() / 1000);
  const claims = base64url(
    JSON.stringify({ iss: config.teamId, iat: now })
  );
  const signingInput = `${header}.${claims}`;

  const pem = config.privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const keyData = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );
  // WebCrypto returns IEEE P1363; APNs expects that for ES256.
  return `${signingInput}.${base64url(sig)}`;
}

async function sendApns(opts: {
  config: ApnsConfig;
  jwt: string;
  deviceToken: string;
  payload: Record<string, unknown>;
  pushType: "liveactivity" | "background";
  topicSuffix?: string;
}): Promise<void> {
  const host = opts.config.production
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
  const topic = opts.topicSuffix
    ? `${opts.config.topic}.${opts.topicSuffix}`
    : opts.config.topic;
  const url = `https://${host}/3/device/${opts.deviceToken}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${opts.jwt}`,
      "apns-topic": topic,
      "apns-push-type": opts.pushType,
      "apns-priority": opts.pushType === "background" ? "5" : "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(opts.payload),
  });
  if (!res.ok) {
    const body = await res.text();
    console.warn("APNs send failed", res.status, body);
  }
}

export const notifyFeedChanged = internalAction({
  args: {
    trackerId: v.id("trackers"),
    lastFeedAt: v.union(v.number(), v.null()),
    babyName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = readApnsConfig();
    if (!config) return null;

    const jwt = await createApnsJwt(config);
    // Only update feed Live Activities — pump/nap timers have their own kind.
    const regs = await ctx.runQuery(internal.apnsHelpers.listLiveActivities, {
      trackerId: args.trackerId,
      kind: "last-feed",
    });
    const devices = await ctx.runQuery(internal.apnsHelpers.listDeviceTokens, {
      trackerId: args.trackerId,
    });

    const title = args.babyName?.trim()
      ? `${args.babyName.trim()} · Last feed`
      : "Last feed";
    const subtitle =
      args.lastFeedAt == null
        ? "No milk feed yet"
        : "Time since last feed";
    const dueAtMs = args.lastFeedAt ?? Date.now();
    // Swift Date JSON (default Codable) = seconds since 2001-01-01.
    const APPLE_REFERENCE_DATE = 978307200;
    const contentState = {
      title,
      subtitle,
      dueAt: dueAtMs / 1000 - APPLE_REFERENCE_DATE,
    };

    // Always end feed Live Activities on feed change. Perpetual "since last
    // feed" islands cover the Dynamic Island / status bar; ongoing feed
    // sessions are started/updated separately via notifyLiveActivityUpdate.
    for (const reg of regs) {
      await sendApns({
        config,
        jwt,
        deviceToken: reg.pushToken,
        pushType: "liveactivity",
        topicSuffix: "push-type.liveactivity",
        payload: {
          aps: {
            timestamp: Math.floor(Date.now() / 1000),
            event: "end",
            "content-state": contentState,
            "attributes-type": "FeedCountdownAttributes",
          },
        },
      });
    }

    for (const device of devices) {
      await sendApns({
        config,
        jwt,
        deviceToken: device.token,
        pushType: "background",
        payload: {
          aps: {
            "content-available": 1,
          },
          trackerId: args.trackerId,
          reason: "feed_changed",
          lastFeedAt: args.lastFeedAt,
        },
      });
    }

    return null;
  },
});

/** Update or end a Live Activity kind (feed ongoing, nap/sleep, etc.). */
export const notifyLiveActivityUpdate = internalAction({
  args: {
    trackerId: v.id("trackers"),
    kind: v.string(),
    event: v.union(v.literal("update"), v.literal("end")),
    title: v.string(),
    subtitle: v.string(),
    dueAtMs: v.number(),
    silentWake: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = readApnsConfig();
    if (!config) return null;

    const jwt = await createApnsJwt(config);
    const regs = await ctx.runQuery(internal.apnsHelpers.listLiveActivities, {
      trackerId: args.trackerId,
      kind: args.kind,
    });

    const APPLE_REFERENCE_DATE = 978307200;
    const contentState = {
      title: args.title,
      subtitle: args.subtitle,
      dueAt: args.dueAtMs / 1000 - APPLE_REFERENCE_DATE,
    };

    for (const reg of regs) {
      await sendApns({
        config,
        jwt,
        deviceToken: reg.pushToken,
        pushType: "liveactivity",
        topicSuffix: "push-type.liveactivity",
        payload: {
          aps: {
            timestamp: Math.floor(Date.now() / 1000),
            event: args.event,
            "content-state": contentState,
            "attributes-type": "FeedCountdownAttributes",
          },
        },
      });
    }

    if (args.silentWake) {
      const devices = await ctx.runQuery(internal.apnsHelpers.listDeviceTokens, {
        trackerId: args.trackerId,
      });
      for (const device of devices) {
        await sendApns({
          config,
          jwt,
          deviceToken: device.token,
          pushType: "background",
          payload: {
            aps: { "content-available": 1 },
            trackerId: args.trackerId,
            reason: "live_activity_update",
            kind: args.kind,
          },
        });
      }
    }

    return null;
  },
});
