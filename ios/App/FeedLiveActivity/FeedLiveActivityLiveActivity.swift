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
                    Image(systemName: "bottle.fill")
                        .foregroundStyle(Color(red: 0.83, green: 0.42, blue: 0.42))
                        .font(.title2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    countdownText(dueAt: context.state.dueAt, font: .title3.weight(.semibold))
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
                Image(systemName: "bottle.fill")
                    .foregroundStyle(Color(red: 0.83, green: 0.42, blue: 0.42))
            } compactTrailing: {
                countdownText(dueAt: context.state.dueAt, font: .caption.weight(.semibold))
            } minimal: {
                Image(systemName: "bottle.fill")
                    .foregroundStyle(Color(red: 0.83, green: 0.42, blue: 0.42))
            }
            .widgetURL(URL(string: "https://it-takes-a-village.vercel.app"))
            .keylineTint(Color(red: 0.83, green: 0.42, blue: 0.42))
        }
    }

    @ViewBuilder
    private func lockScreenView(context: ActivityViewContext<FeedCountdownAttributes>) -> some View {
        HStack(spacing: 14) {
            Image(systemName: "bottle.fill")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(Color(red: 0.83, green: 0.42, blue: 0.42))
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

            countdownText(dueAt: context.state.dueAt, font: .title2.monospacedDigit().weight(.bold))
                .foregroundStyle(Color(red: 0.55, green: 0.22, blue: 0.20))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    @ViewBuilder
    private func countdownText(dueAt: Date, font: Font) -> some View {
        Text(dueAt, style: .timer)
            .font(font)
            .multilineTextAlignment(.trailing)
            .monospacedDigit()
            .contentTransition(.numericText())
    }
}
