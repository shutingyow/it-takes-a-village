import ActivityKit
import Foundation

/// Shared between the main app and FeedLiveActivity widget extension.
public struct FeedCountdownAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        public var title: String
        public var subtitle: String
        /// Absolute due time for the next feed (ActivityKit timer drives UI).
        public var dueAt: Date

        public init(title: String, subtitle: String, dueAt: Date) {
            self.title = title
            self.subtitle = subtitle
            self.dueAt = dueAt
        }
    }

    /// Stable key so we only keep one next-feed activity.
    public var kind: String

    public init(kind: String = "next-feed") {
        self.kind = kind
    }
}
