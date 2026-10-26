import UIKit
import Capacitor

/// Registers in-app Capacitor plugins that are not npm packages
/// (so they never appear in `packageClassList` after `cap sync`).
class AppBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(FeedLiveActivityPlugin())
    }
}
