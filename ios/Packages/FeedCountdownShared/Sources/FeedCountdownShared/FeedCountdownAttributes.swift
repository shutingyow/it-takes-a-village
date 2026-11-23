import ActivityKit
import Foundation

/// Shared between the main app and FeedLiveActivity widget extension.
public struct FeedCountdownAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        public var title: String
        public var subtitle: String
        /// Last-event time as Unix seconds (not `Date`) so ActivityKit APNs
        /// content-state JSON decodes reliably on every device.
        /// Always store Unix seconds since 1970 — never the Apple 2001 reference
        /// interval (see `FeedCountdownTime`).
        public var dueAt: Double

        public init(title: String, subtitle: String, dueAt: Double) {
            self.title = title
            self.subtitle = subtitle
            self.dueAt = FeedCountdownTime.saneUnixSeconds(dueAt)
        }

        public init(title: String, subtitle: String, dueAt: Date) {
            self.title = title
            self.subtitle = subtitle
            self.dueAt = FeedCountdownTime.saneUnixSeconds(dueAt.timeIntervalSince1970)
        }

        /// Wall-clock start for `Text(..., .timer)` / `timerInterval`.
        /// Tolerates legacy APNs payloads that subtracted the 2001 reference offset.
        public var dueAtDate: Date {
            FeedCountdownTime.date(fromStoredDueAt: dueAt)
        }
    }

    /// Stable key per timer type: "last-feed" | "last-pump" | "last-nap".
    public var kind: String

    public init(kind: String = "last-feed") {
        self.kind = kind
    }
}

/// Epoch helpers for Live Activity timestamps.
///
/// `271752` hours ≈ `978307200` seconds (Apple reference date → Unix). A Lock
/// Screen timer near that value means `dueAt` was stored or decoded with the
/// wrong epoch. Keep ContentState on Unix seconds and sanitize on read/write.
public enum FeedCountdownTime {
    /// 2001-01-01 00:00:00 UTC, as seconds.
    public static let referenceDateOffset: TimeInterval = 978_307_200

    /// Convert epoch milliseconds (JS `Date.now()`) to sane Unix seconds.
    public static func unixSeconds(fromMs ms: Double) -> Double {
        guard ms.isFinite, ms > 0 else {
            return Date().timeIntervalSince1970
        }
        // Seconds mistaken for ms (e.g. ~1.7e9) vs true ms (~1.7e12).
        let seconds = ms < 1_000_000_000_000 ? ms : ms / 1000.0
        return saneUnixSeconds(seconds)
    }

    /// Prefer Unix seconds; if `raw` is a 2001-reference interval, convert.
    public static func saneUnixSeconds(_ raw: Double) -> Double {
        guard raw.isFinite, raw > 0 else {
            return Date().timeIntervalSince1970
        }

        let now = Date()
        // Baby-tracker events are recent; allow clock skew of 1 minute.
        let earliest = now.addingTimeInterval(-90 * 24 * 60 * 60)
        let latest = now.addingTimeInterval(60)

        let asUnix = Date(timeIntervalSince1970: raw)
        if asUnix >= earliest && asUnix <= latest {
            return raw
        }

        let asRef = Date(timeIntervalSinceReferenceDate: raw)
        if asRef >= earliest && asRef <= latest {
            return asRef.timeIntervalSince1970
        }

        // Legacy APNs: `unix - 978307200` stored into a Unix-seconds field.
        if raw < referenceDateOffset {
            let repaired = raw + referenceDateOffset
            let repairedDate = Date(timeIntervalSince1970: repaired)
            if repairedDate >= earliest && repairedDate <= latest {
                return repaired
            }
        }

        return min(max(raw, earliest.timeIntervalSince1970), now.timeIntervalSince1970)
    }

    public static func date(fromStoredDueAt dueAt: Double) -> Date {
        Date(timeIntervalSince1970: saneUnixSeconds(dueAt))
    }

    public static func isSaneStartDate(_ date: Date) -> Bool {
        let now = Date()
        return date <= now.addingTimeInterval(60)
            && date > now.addingTimeInterval(-90 * 24 * 60 * 60)
    }

    /// True when the stored Double is already Unix seconds in a plausible range
    /// (does not apply reference-date repair — used to detect stuck activities).
    public static func isSaneRawDueAt(_ raw: Double) -> Bool {
        isSaneStartDate(Date(timeIntervalSince1970: raw))
    }
}
