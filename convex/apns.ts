"use node";

import { once } from "node:events";
import http2 from "node:http2";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Push Live Activity + silent wakes when a milk feed / pump / sleep changes.
 * No-ops if APNs env is not configured (web-only / pre-key setups).
 *
 * Env (Convex dashboard):
 * - APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC (com.ittakesavillage.app)
 * - APNS_PRIVATE_KEY (PKCS8 .p8 contents, newlines OK as \n; PEM headers optional)
 * - APNS_PRODUCTION = "true" for App Store / TestFlight production APNs
 *
 * Cross-caregiver path (timer delivery mode):
 * 1. ActivityKit `liveactivity` update to every village kind push token
 * 2. Silent `background` wake so native AppDelegate can update/restart the
 *    Lock Screen timer without opening the app
 *
 * IMPORTANT: APNs requires HTTP/2. Node's built-in `fetch` (undici) speaks
 * HTTP/1.1 by default and fails with `TypeError: fetch failed` against
 * api.push.apple.com — always use `node:http2` here.
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

type SendResult = "ok" | "gone" | "error";

/** APNs reasons that mean this token must never be used again. */
function isGoneReason(status: number, body: string): boolean {
  if (status === 410) return true;
  if (status !== 400 && status !== 403) return false;
  try {
    const parsed = JSON.parse(body) as { reason?: string };
    const reason = parsed.reason ?? "";
    return (
      reason === "BadDeviceToken" ||
      reason === "Unregistered" ||
      reason === "ExpiredToken" ||
      reason === "DeviceTokenNotForTopic" ||
      reason === "TopicDisallowed"
    );
  } catch {
    return false;
  }
}

type ApnsSession = {
  client: http2.ClientHttp2Session;
  host: string;
};

async function openApnsSession(config: ApnsConfig): Promise<ApnsSession> {
  const host = config.production
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com";
  const client = http2.connect(`https://${host}`);
  client.on("error", (err) => {
    console.warn("APNs HTTP/2 session error", err);
  });
  if (!client.connecting && client.closed) {
    throw new Error("APNs HTTP/2 session closed immediately");
  }
  if (client.connecting) {
    await once(client, "connect");
  }
  return { client, host };
}

function sendApnsOnSession(opts: {
  session: ApnsSession;
  config: ApnsConfig;
  jwt: string;
  deviceToken: string;
  payload: Record<string, unknown>;
  pushType: "liveactivity" | "background";
  topicSuffix?: string;
}): Promise<SendResult> {
  const topic = opts.topicSuffix
    ? `${opts.config.topic}.${opts.topicSuffix}`
    : opts.config.topic;
  const path = `/3/device/${opts.deviceToken}`;
  const body = JSON.stringify(opts.payload);

  return new Promise((resolve) => {
    let status = 0;
    let responseBody = "";
    const req = opts.session.client.request({
      ":method": "POST",
      ":path": path,
      authorization: `bearer ${opts.jwt}`,
      "apns-topic": topic,
      "apns-push-type": opts.pushType,
      "apns-priority": opts.pushType === "background" ? "5" : "10",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(body),
    });

    req.setEncoding("utf8");
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      if (status >= 200 && status < 300) {
        resolve("ok");
        return;
      }
      console.warn("APNs send failed", status, responseBody, opts.pushType);
      // BadDeviceToken / Unregistered / 410 — drop so we stop hammering
      // dead TF tokens and silent-wake can re-register on next app open.
      if (isGoneReason(status, responseBody)) {
        resolve("gone");
        return;
      }
      resolve("error");
    });
    req.on("error", (err) => {
      console.warn("APNs request error", err, opts.pushType);
      resolve("error");
    });
    req.end(body);
  });
}

/**
 * ContentState.dueAt is Unix seconds (Double) — see FeedCountdownAttributes.
 * Never subtract Apple's 2001 reference offset (978307200): that produced the
 * Lock Screen ~271752h feed timer when paired with Date(timeIntervalSince1970:).
 */
function contentState(opts: {
  title: string;
  subtitle: string;
  dueAtMs: number;
}) {
  const ms =
    opts.dueAtMs > 0 && opts.dueAtMs < 1_000_000_000_000
      ? opts.dueAtMs * 1000
      : opts.dueAtMs;
  return {
    title: opts.title,
    subtitle: opts.subtitle,
    dueAt: ms / 1000,
  };
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

    let session: ApnsSession;
    try {
      session = await openApnsSession(config);
    } catch (err) {
      console.warn("APNs HTTP/2 connect failed", err);
      return null;
    }

    try {
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
      const state = contentState({ title, subtitle, dueAtMs });

      // Update since-last feed on every village device that has a running LA
      // (or end when no milk feed). Ongoing feed sessions are pushed separately
      // via notifyLiveActivityUpdate.
      for (const reg of regs) {
        const result = await sendApnsOnSession({
          session,
          config,
          jwt,
          deviceToken: reg.pushToken,
          pushType: "liveactivity",
          topicSuffix: "push-type.liveactivity",
          payload: {
            aps: {
              timestamp: Math.floor(Date.now() / 1000),
              event: args.lastFeedAt == null ? "end" : "update",
              "content-state": state,
              "attributes-type": "FeedCountdownAttributes",
            },
          },
        });
        if (result === "gone") {
          await ctx.runMutation(
            internal.apnsHelpers.deleteLiveActivityByActivityId,
            { activityId: reg.activityId }
          );
        }
      }

      // Silent wake: native AppDelegate updates/restarts the feed LA even when
      // ActivityKit push tokens are missing or stale (timer delivery mode).
      for (const device of devices) {
        const result = await sendApnsOnSession({
          session,
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
        if (result === "gone") {
          await ctx.runMutation(internal.apnsHelpers.deleteDeviceTokenByDevice, {
            trackerId: args.trackerId,
            deviceId: device.deviceId,
          });
        }
      }
    } finally {
      session.client.close();
    }

    return null;
  },
});

/** Update or end a Live Activity kind (feed ongoing, nap/sleep, pump, etc.). */
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

    let session: ApnsSession;
    try {
      session = await openApnsSession(config);
    } catch (err) {
      console.warn("APNs HTTP/2 connect failed", err);
      return null;
    }

    try {
      const jwt = await createApnsJwt(config);
      const regs = await ctx.runQuery(internal.apnsHelpers.listLiveActivities, {
        trackerId: args.trackerId,
        kind: args.kind,
      });

      const state = contentState({
        title: args.title,
        subtitle: args.subtitle,
        dueAtMs: args.dueAtMs,
      });

      for (const reg of regs) {
        const result = await sendApnsOnSession({
          session,
          config,
          jwt,
          deviceToken: reg.pushToken,
          pushType: "liveactivity",
          topicSuffix: "push-type.liveactivity",
          payload: {
            aps: {
              timestamp: Math.floor(Date.now() / 1000),
              event: args.event,
              "content-state": state,
              "attributes-type": "FeedCountdownAttributes",
            },
          },
        });
        if (result === "gone") {
          await ctx.runMutation(
            internal.apnsHelpers.deleteLiveActivityByActivityId,
            { activityId: reg.activityId }
          );
        }
      }

      if (args.silentWake) {
        const devices = await ctx.runQuery(internal.apnsHelpers.listDeviceTokens, {
          trackerId: args.trackerId,
        });
        for (const device of devices) {
          const result = await sendApnsOnSession({
            session,
            config,
            jwt,
            deviceToken: device.token,
            pushType: "background",
            payload: {
              aps: { "content-available": 1 },
              trackerId: args.trackerId,
              reason: "live_activity_update",
              kind: args.kind,
              event: args.event,
              title: args.title,
              subtitle: args.subtitle,
              dueAtMs: args.dueAtMs,
            },
          });
          if (result === "gone") {
            await ctx.runMutation(
              internal.apnsHelpers.deleteDeviceTokenByDevice,
              {
                trackerId: args.trackerId,
                deviceId: device.deviceId,
              }
            );
          }
        }
      }
    } finally {
      session.client.close();
    }

    return null;
  },
});
