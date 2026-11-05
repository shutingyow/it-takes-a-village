//
//  FeedLiveActivityLiveActivity.swift
//  FeedLiveActivity
//

import ActivityKit
import WidgetKit
import SwiftUI
import FeedCountdownShared

struct FeedLiveActivityLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FeedCountdownAttributes.self) { context in
            lockScreenView(context: context)
                .activityBackgroundTint(Color(red: 0.98, green: 0.93, blue: 0.91))
                .activitySystemActionForegroundColor(Color(red: 0.55, green: 0.28, blue: 0.26))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: iconName(for: context.attributes.kind))
                        .foregroundStyle(accentColor(for: context.attributes.kind))
                        .font(.title2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    sinceText(from: context.state.dueAt, font: .title3.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            } compactLeading: {
                Image(systemName: iconName(for: context.attributes.kind))
                    .foregroundStyle(accentColor(for: context.attributes.kind))
            } compactTrailing: {
                sinceText(from: context.state.dueAt, font: .caption.weight(.semibold))
            } minimal: {
                Image(systemName: iconName(for: context.attributes.kind))
                    .foregroundStyle(accentColor(for: context.attributes.kind))
            }
            .widgetURL(URL(string: "https://it-takes-a-village.vercel.app"))
            .keylineTint(accentColor(for: context.attributes.kind))
        }
    }

    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<FeedCountdownAttributes>) -> some View {
        HStack(spacing: 14) {
            Image(systemName: iconName(for: context.attributes.kind))
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(accentColor(for: context.attributes.kind))
                .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(context.state.title)
                    .font(.headline)
                    .foregroundStyle(Color(red: 0.25, green: 0.18, blue: 0.16))
                Text(context.state.subtitle)
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.45, green: 0.38, blue: 0.35))
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            sinceText(from: context.state.dueAt, font: .title2.monospacedDigit().weight(.bold))
                .foregroundStyle(Color(red: 0.55, green: 0.22, blue: 0.20))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    /// Counts *up* from last event (past date + `.timer`).
    @ViewBuilder
    private func sinceText(from lastAt: Date, font: Font) -> some View {
        Text(lastAt, style: .timer)
            .font(font)
            .multilineTextAlignment(.trailing)
            .monospacedDigit()
            .contentTransition(.numericText())
    }

    private func iconName(for kind: String) -> String {
        switch kind {
        case "last-pump":
            return "drop.fill"
        case "last-nap":
            return "moon.zzz.fill"
        default:
            return "bottle.fill"
        }
    }

    private func accentColor(for kind: String) -> Color {
        switch kind {
        case "last-pump":
            return Color(red: 0.56, green: 0.64, blue: 0.72) // soft blue-grey
        case "last-nap":
            return Color(red: 0.45, green: 0.42, blue: 0.62) // soft indigo
        default:
            return Color(red: 0.83, green: 0.42, blue: 0.42) // terracotta
        }
    }
}
