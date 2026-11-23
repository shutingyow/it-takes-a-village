import Foundation
import Capacitor
import ActivityKit
import FeedCountdownShared

/**
 * Native Live Activity bridge for time-since-last feed / pump / nap.
 * Registered manually from AppBridgeViewController (not an npm Cap plugin).
 * `dueAtMs` is the last-event timestamp — the widget timer counts up from it.
 * `kind`: "last-feed" | "last-pump" | "last-nap"
 *
 * Always keeps at most one ActivityKit session per kind so stale JS IDs
 * cannot leave orphan banners (double Live Activities).
 *
 * Cross-caregiver sync: ActivityKit push tokens update running activities;
 * silent `feed_changed` wakes also call `FeedLiveActivityRemote` so timer-mode
 * devices refresh without opening the app.
 */
@objc(FeedLiveActivityPlugin)
public class FeedLiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FeedLiveActivityPlugin"
    public let jsName = "FeedLiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "areActivitiesSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKindEnabled", returnType: CAPPluginReturnPromise),
    ]

    private static let knownKinds: Set<String> = ["last-feed", "last-pump", "last-nap", "next-feed"]

    @objc func areActivitiesSupported(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve([
                "supported": false,
                "reason": "iOS 16.2 or later is required for Live Activities",
            ])
            return
        }

        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        if enabled {
            call.resolve(["supported": true])
        } else {
            call.resolve([
                "supported": false,
                "reason": "Live Activities are disabled in Settings",
            ])
        }
    }

    @objc func setKindEnabled(_ call: CAPPluginCall) {
        let kind = normalizedKind(call.getString("kind"))
        let enabled = call.getBool("enabled") ?? false
        FeedLiveActivityRemote.setKindEnabled(kind, enabled: enabled)
        call.resolve()
    }

    @objc func startActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later")
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are disabled in Settings")
            return
        }

        let kind = normalizedKind(call.getString("kind"))
        guard let state = contentState(from: call) else {
            call.reject("title, subtitle, and dueAtMs are required")
            return
        }

        Task { @MainActor in
            await endActivities(matchingKind: kind)
            do {
                let activity = try Self.requestActivityReturning(kind: kind, state: state)
                await Self.endExtras(matchingKind: kind, keepingId: activity.id)
                Self.observePushToken(activity: activity, plugin: self)
                call.resolve(["activityId": activity.id])
            } catch {
                call.reject("Failed to start Live Activity: \(error.localizedDescription)")
            }
        }
    }

    @objc func updateActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later")
            return
        }

        let kind = normalizedKind(call.getString("kind"))
        guard let state = contentState(from: call) else {
            call.reject("title, subtitle, and dueAtMs are required")
            return
        }

        let activityId = call.getString("activityId")

        Task { @MainActor in
            var matches = Activity<FeedCountdownAttributes>.activities.filter { activity in
                if let activityId {
                    return activity.id == activityId
                }
                return activity.attributes.kind == kind
            }

            // Stale JS id: fall back to any live session of this kind.
            if matches.isEmpty, activityId != nil {
                matches = Activity<FeedCountdownAttributes>.activities.filter {
                    $0.attributes.kind == kind
                }
            }

            if matches.isEmpty {
                // End orphans of this kind before creating a replacement.
                await endActivities(matchingKind: kind)
                do {
                    let activity = try Self.requestActivityReturning(kind: kind, state: state)
                    await Self.endExtras(matchingKind: kind, keepingId: activity.id)
                    Self.observePushToken(activity: activity, plugin: self)
                    call.resolve(["activityId": activity.id])
                } catch {
                    call.reject("Failed to start Live Activity: \(error.localizedDescription)")
                }
                return
            }

            // Corrupt epoch on an existing session (classic ~271752h timer) —
            // end and recreate instead of updating in place.
            let corrupt = matches.contains {
                !FeedCountdownTime.isSaneRawDueAt($0.contentState.dueAt)
            }
            if corrupt {
                for activity in matches {
                    await activity.end(
                        ActivityContent(state: activity.contentState, staleDate: nil),
                        dismissalPolicy: .immediate
                    )
                }
                do {
                    let activity = try Self.requestActivityReturning(kind: kind, state: state)
                    await Self.endExtras(matchingKind: kind, keepingId: activity.id)
                    Self.observePushToken(activity: activity, plugin: self)
                    call.resolve(["activityId": activity.id])
                } catch {
                    call.reject("Failed to replace Live Activity: \(error.localizedDescription)")
                }
                return
            }

            // dueAt is the last-event time (often hours ago). Stale relative to
            // that date would mark long gaps as immediately outdated.
            let content = ActivityContent(
                state: state,
                staleDate: Date().addingTimeInterval(24 * 60 * 60)
            )
            let keepId = matches.first?.id
            for activity in matches {
                await activity.update(content)
                Self.observePushToken(activity: activity, plugin: self)
            }
            if let keepId {
                await Self.endExtras(matchingKind: kind, keepingId: keepId)
            }
            call.resolve(["activityId": keepId ?? ""])
        }
    }

    @objc func endActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }

        let activityId = call.getString("activityId")
        let kind = call.getString("kind").map { normalizedKind($0) }

        Task { @MainActor in
            // End by id ∪ kind so a stale localStorage id cannot leave orphans.
            var seen = Set<String>()
            var matches: [Activity<FeedCountdownAttributes>] = []

            if let activityId {
                for activity in Activity<FeedCountdownAttributes>.activities
                where activity.id == activityId {
                    if seen.insert(activity.id).inserted {
                        matches.append(activity)
                    }
                }
            }

            if let kind {
                for activity in Activity<FeedCountdownAttributes>.activities
                where activity.attributes.kind == kind {
                    if seen.insert(activity.id).inserted {
                        matches.append(activity)
                    }
                }
            } else if activityId == nil {
                for activity in Activity<FeedCountdownAttributes>.activities
                where activity.attributes.kind == "last-feed"
                    || activity.attributes.kind == "next-feed"
                {
                    if seen.insert(activity.id).inserted {
                        matches.append(activity)
                    }
                }
            }

            for activity in matches {
                await activity.end(
                    ActivityContent(state: activity.contentState, staleDate: nil),
                    dismissalPolicy: .immediate
                )
            }
            call.resolve()
        }
    }

    @objc func endAll(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task { @MainActor in
            await endAllActivities()
            call.resolve()
        }
    }

    @available(iOS 16.2, *)
    private func endActivities(matchingKind kind: String) async {
        for activity in Activity<FeedCountdownAttributes>.activities where activity.attributes.kind == kind {
            await activity.end(
                ActivityContent(state: activity.contentState, staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
    }

    /// Ends every session of `kind` except the one we intend to keep.
    @available(iOS 16.2, *)
    private static func endExtras(matchingKind kind: String, keepingId: String) async {
        for activity in Activity<FeedCountdownAttributes>.activities
        where activity.attributes.kind == kind && activity.id != keepingId {
            await activity.end(
                ActivityContent(state: activity.contentState, staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
    }

    @available(iOS 16.2, *)
    private func endAllActivities() async {
        for activity in Activity<FeedCountdownAttributes>.activities {
            await activity.end(
                ActivityContent(state: activity.contentState, staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
    }

    @available(iOS 16.2, *)
    private static func requestActivityReturning(
        kind: String,
        state: FeedCountdownAttributes.ContentState
    ) throws -> Activity<FeedCountdownAttributes> {
        let attributes = FeedCountdownAttributes(kind: kind)
        // Count-up from a past dueAt — keep the activity fresh for a day from now.
        let content = ActivityContent(
            state: state,
            staleDate: Date().addingTimeInterval(24 * 60 * 60)
        )
        // .token enables ActivityKit APNs updates from Convex when another
        // caregiver logs while this device is backgrounded.
        return try Activity.request(
            attributes: attributes,
            content: content,
            pushType: .token
        )
    }

    @available(iOS 16.2, *)
    private static func observePushToken(
        activity: Activity<FeedCountdownAttributes>,
        plugin: FeedLiveActivityPlugin
    ) {
        Task {
            for await tokenData in activity.pushTokenUpdates {
                let hex = tokenData.map { String(format: "%02x", $0) }.joined()
                plugin.notifyListeners("liveActivityPushToken", data: [
                    "activityId": activity.id,
                    "pushToken": hex,
                    "kind": activity.attributes.kind,
                ])
            }
        }
    }

    private func normalizedKind(_ raw: String?) -> String {
        let kind = (raw ?? "last-feed").trimmingCharacters(in: .whitespacesAndNewlines)
        if Self.knownKinds.contains(kind) { return kind }
        return "last-feed"
    }

    private func contentState(from call: CAPPluginCall) -> FeedCountdownAttributes.ContentState? {
        guard let title = call.getString("title"),
              let subtitle = call.getString("subtitle") else {
            return nil
        }

        let dueAtMs: Double?
        if let value = call.getDouble("dueAtMs") {
            dueAtMs = value
        } else if let value = call.getInt("dueAtMs") {
            dueAtMs = Double(value)
        } else if let number = call.getAny("dueAtMs") as? NSNumber {
            dueAtMs = number.doubleValue
        } else {
            dueAtMs = nil
        }

        guard let dueAtMs else { return nil }

        return FeedCountdownAttributes.ContentState(
            title: title,
            subtitle: subtitle,
            dueAt: FeedCountdownTime.unixSeconds(fromMs: dueAtMs)
        )
    }
}

/// Applies remote feed / Live Activity updates without the WebView
/// (silent APNs wakes while the app is backgrounded).
enum FeedLiveActivityRemote {
    private static let defaults = UserDefaults.standard
    private static func enabledKey(_ kind: String) -> String {
        "ittav.liveActivity.\(kind).enabled"
    }

    static func setKindEnabled(_ kind: String, enabled: Bool) {
        defaults.set(enabled, forKey: enabledKey(kind))
    }

    static func isKindEnabled(_ kind: String) -> Bool {
        // Default feed on (matches JS); pump/nap opt-in.
        if defaults.object(forKey: enabledKey(kind)) == nil {
            return kind == "last-feed"
        }
        return defaults.bool(forKey: enabledKey(kind))
    }

    /// Silent `feed_changed` from Convex — reset since-last feed timer.
    @available(iOS 16.2, *)
    static func applyFeedChanged(lastFeedAtMs: Double?) async {
        let kind = "last-feed"
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        if let lastFeedAtMs, lastFeedAtMs > 0, lastFeedAtMs.isFinite {
            let title = "Last feed"
            let subtitle = "Time since last feed"
            let state = FeedCountdownAttributes.ContentState(
                title: title,
                subtitle: subtitle,
                dueAt: FeedCountdownTime.unixSeconds(fromMs: lastFeedAtMs)
            )
            await upsert(kind: kind, state: state, startIfMissing: isKindEnabled(kind))
        } else {
            await end(kind: kind)
        }
    }

    /// Silent `live_activity_update` for any kind (ongoing feed / nap, etc.).
    @available(iOS 16.2, *)
    static func applyLiveActivityUpdate(
        kind rawKind: String,
        event: String,
        title: String,
        subtitle: String,
        dueAtMs: Double
    ) async {
        let kind = normalizedKind(rawKind)
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        if event == "end" {
            await end(kind: kind)
            return
        }

        guard dueAtMs > 0, dueAtMs.isFinite else { return }
        let state = FeedCountdownAttributes.ContentState(
            title: title.isEmpty ? defaultTitle(for: kind) : title,
            subtitle: subtitle,
            dueAt: FeedCountdownTime.unixSeconds(fromMs: dueAtMs)
        )
        await upsert(kind: kind, state: state, startIfMissing: isKindEnabled(kind))
    }

    @available(iOS 16.2, *)
    private static func upsert(
        kind: String,
        state: FeedCountdownAttributes.ContentState,
        startIfMissing: Bool
    ) async {
        var matches = Activity<FeedCountdownAttributes>.activities.filter {
            $0.attributes.kind == kind
        }
        let content = ActivityContent(
            state: state,
            staleDate: Date().addingTimeInterval(24 * 60 * 60)
        )

        // Corrupt epoch (~271752h timer) — end and recreate so Lock Screen
        // does not keep a stuck ActivityKit session.
        let corrupt = matches.contains {
            !FeedCountdownTime.isSaneRawDueAt($0.contentState.dueAt)
        }
        if corrupt {
            for activity in matches {
                await activity.end(
                    ActivityContent(state: activity.contentState, staleDate: nil),
                    dismissalPolicy: .immediate
                )
            }
            matches = []
        }

        if !matches.isEmpty {
            for activity in matches {
                await activity.update(content)
            }
            return
        }

        guard startIfMissing else { return }
        do {
            _ = try Activity.request(
                attributes: FeedCountdownAttributes(kind: kind),
                content: content,
                pushType: .token
            )
        } catch {
            NSLog("FeedLiveActivityRemote start failed: %@", error.localizedDescription)
        }
    }

    @available(iOS 16.2, *)
    private static func end(kind: String) async {
        for activity in Activity<FeedCountdownAttributes>.activities
        where activity.attributes.kind == kind {
            await activity.end(
                ActivityContent(state: activity.contentState, staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
    }

    private static func normalizedKind(_ raw: String) -> String {
        let kind = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if ["last-feed", "last-pump", "last-nap", "next-feed"].contains(kind) {
            return kind
        }
        return "last-feed"
    }

    private static func defaultTitle(for kind: String) -> String {
        switch kind {
        case "last-pump": return "Last pump"
        case "last-nap": return "Awake since"
        default: return "Last feed"
        }
    }
}
