import ActivityKit
import Foundation

/// Shared between the main app and FeedLiveActivity widget extension.
public struct FeedCountdownAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        public var title: String
        public var subtitle: String
        /// Last event time — Text(..., .timer) counts *up* from a past date.
        public var dueAt: Date

        public init(title: String, subtitle: String, dueAt: Date) {
            self.title = title
            self.subtitle = subtitle
            self.dueAt = dueAt
        }
    }

    /// Stable key per timer type: "last-feed" | "last-pump" | "last-nap".
    public var kind: String

    public init(kind: String = "last-feed") {
        self.kind = kind
    }
}
