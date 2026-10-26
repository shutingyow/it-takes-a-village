import Foundation
import Capacitor
import ActivityKit
import FeedCountdownShared

/**
 * Native Live Activity bridge for next-feed countdown.
 * Registered manually from AppBridgeViewController (not an npm Cap plugin).
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
    ]

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

    @objc func startActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.reject("Live Activities require iOS 16.2 or later")
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities are disabled in Settings")
            return
        }

        guard let state = contentState(from: call) else {
            call.reject("title, subtitle, and dueAtMs are required")
            return
        }

        Task { @MainActor in
            await endAllActivities()
            do {
                let activityId = try Self.requestActivity(state: state)
                call.resolve(["activityId": activityId])
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

        guard let state = contentState(from: call) else {
            call.reject("title, subtitle, and dueAtMs are required")
            return
        }

        let activityId = call.getString("activityId")

        Task { @MainActor in
            let matches = Activity<FeedCountdownAttributes>.activities.filter { activity in
                if let activityId {
                    return activity.id == activityId
                }
                return activity.attributes.kind == "next-feed"
            }

            if matches.isEmpty {
                do {
                    let newId = try Self.requestActivity(state: state)
                    call.resolve(["activityId": newId])
                } catch {
                    call.reject("Failed to start Live Activity: \(error.localizedDescription)")
                }
                return
            }

            let content = ActivityContent(
                state: state,
                staleDate: state.dueAt.addingTimeInterval(30 * 60)
            )
            for activity in matches {
                await activity.update(content)
            }
            call.resolve(["activityId": matches.first?.id ?? ""])
        }
    }

    @objc func endActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }

        let activityId = call.getString("activityId")
        Task { @MainActor in
            let matches = Activity<FeedCountdownAttributes>.activities.filter { activity in
                if let activityId {
                    return activity.id == activityId
                }
                return activity.attributes.kind == "next-feed"
            }
            for activity in matches {
                await activity.end(
                    ActivityContent(state: activity.content.state, staleDate: nil),
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
    private func endAllActivities() async {
        for activity in Activity<FeedCountdownAttributes>.activities {
            await activity.end(
                ActivityContent(state: activity.content.state, staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
    }

    @available(iOS 16.2, *)
    private static func requestActivity(state: FeedCountdownAttributes.ContentState) throws -> String {
        let attributes = FeedCountdownAttributes(kind: "next-feed")
        let content = ActivityContent(
            state: state,
            staleDate: state.dueAt.addingTimeInterval(30 * 60)
        )
        let activity = try Activity.request(
            attributes: attributes,
            content: content,
            pushType: nil
        )
        return activity.id
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
            dueAt: Date(timeIntervalSince1970: dueAtMs / 1000)
        )
    }
}
