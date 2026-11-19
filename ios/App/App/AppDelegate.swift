import UIKit
import Capacitor
import UserNotifications
import ActivityKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// Must match `NOTIF_ID` in `app/lib/deviceNotifications.ts`.
    private static let dueLocalNotificationIds: [String] = [
        "1001",
        "1101", "1102", "1103", "1104", "1105", "1106",
        "2001", "2002", "2003", "2004", "2005", "2006",
        "3001",
    ]

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

    // MARK: - APNs token → Capacitor PushNotifications

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    // MARK: - Silent wake: cancel stale alerts + refresh Live Activities

    /// Capacitor's JS push plugin does not run for iOS content-available wakes.
    /// When another caregiver logs a feed, Convex sends a silent push; cancel
    /// pending local schedules and update/restart the since-last feed Live
    /// Activity so timer-mode devices stay current without opening the app.
    func application(_ application: UIApplication,
                     didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        let reason = userInfo["reason"] as? String

        if reason == "feed_changed" {
            Self.cancelDueLocalNotifications()
            let lastFeedAtMs = Self.doubleValue(userInfo["lastFeedAt"])
            if #available(iOS 16.2, *) {
                Task {
                    await FeedLiveActivityRemote.applyFeedChanged(lastFeedAtMs: lastFeedAtMs)
                    completionHandler(.newData)
                }
                return
            }
            completionHandler(.newData)
            return
        }

        if reason == "live_activity_update" {
            let kind = (userInfo["kind"] as? String) ?? "last-feed"
            let event = (userInfo["event"] as? String) ?? "update"
            let title = (userInfo["title"] as? String) ?? ""
            let subtitle = (userInfo["subtitle"] as? String) ?? ""
            let dueAtMs = Self.doubleValue(userInfo["dueAtMs"]) ?? 0
            if #available(iOS 16.2, *) {
                Task {
                    await FeedLiveActivityRemote.applyLiveActivityUpdate(
                        kind: kind,
                        event: event,
                        title: title,
                        subtitle: subtitle,
                        dueAtMs: dueAtMs
                    )
                    completionHandler(.newData)
                }
                return
            }
            completionHandler(.newData)
            return
        }

        completionHandler(.noData)
    }

    static func cancelDueLocalNotifications() {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: dueLocalNotificationIds)
        center.removeDeliveredNotifications(withIdentifiers: dueLocalNotificationIds)
    }

    private static func doubleValue(_ raw: Any?) -> Double? {
        if raw == nil || raw is NSNull { return nil }
        if let n = raw as? Double { return n }
        if let n = raw as? Int { return Double(n) }
        if let n = raw as? NSNumber { return n.doubleValue }
        if let s = raw as? String, let n = Double(s) { return n }
        return nil
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }
}
