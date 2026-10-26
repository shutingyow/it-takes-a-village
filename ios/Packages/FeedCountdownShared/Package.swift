// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FeedCountdownShared",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "FeedCountdownShared", targets: ["FeedCountdownShared"])
    ],
    targets: [
        .target(name: "FeedCountdownShared")
    ]
)
