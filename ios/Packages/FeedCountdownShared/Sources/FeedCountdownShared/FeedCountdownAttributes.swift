import ActivityKit
import Foundation

/// Shared between the main app and FeedLiveActivity widget extension.
public struct FeedCountdownAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        public var title: String
        public var subtitle: String
        /// Last-event time as Unix seconds (not `Date`) so ActivityKit APNs
        /// content-state JSON decodes reliably on every device.
        public var dueAt: Double

        public init(title: String, subtitle: String, dueAt: Double) {
            self.title = title
            self.subtitle = subtitle
            self.dueAt = dueAt
        }

        public init(title: String, subtitle: String, dueAt: Date) {
            self.title = title
            self.subtitle = subtitle
            self.dueAt = dueAt.timeIntervalSince1970
        }

        public var dueAtDate: Date {
            Date(timeIntervalSince1970: dueAt)
        }
    }

    /// Stable key per timer type: "last-feed" | "last-pump" | "last-nap".
    public var kind: String

    public init(kind: String = "last-feed") {
        self.kind = kind
    }
}
