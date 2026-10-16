import { cn } from "@/app/lib/utils";
import type { ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({
  size = 20,
  className,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </Icon>
  );
}

export function IconNotes(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z" />
      <path d="M9 12h6M9 16h4" />
    </Icon>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </Icon>
  );
}

export function IconMore(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Baby bottle for Feed tiles / timetable. */
export function IconFeed(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2h4v2.2l1.2 1.2a2 2 0 0 1 .6 1.4V8H8V6.8a2 2 0 0 1 .6-1.4L9.8 4.2V2Z" />
      <path d="M8 8h8v9.5a2.5 2.5 0 0 1-2.5 2.5h-3A2.5 2.5 0 0 1 8 17.5V8Z" />
      <path d="M10 11h4" />
    </Icon>
  );
}

export function IconMoment(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 13.8 8.6 19.2 9l-4 3.4 1.2 5.1L12 15l-4.4 2.5L8.8 12.4 4.8 9l5.4-.4L12 3.5Z" />
    </Icon>
  );
}

export function IconActivity(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l2.5 1.5" />
    </Icon>
  );
}

/** Crescent moon for Nap tiles / timetable. */
export function IconSleep(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.5 14.2A8 8 0 0 1 9.8 3.5 8.2 8.2 0 1 0 20.5 14.2Z" />
    </Icon>
  );
}

/** Simple diaper outline. */
export function IconDiaper(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7.5c0-.8.7-1.5 1.5-1.5h11c.8 0 1.5.7 1.5 1.5V11c0 3.5-2.2 6.5-6 7.5-3.8-1-6-4-6-7.5V7.5Z" />
      <path d="M5 11h4.5M14.5 11H19" />
      <path d="M9.5 11c.6 1.8 1.4 2.8 2.5 2.8s1.9-1 2.5-2.8" />
    </Icon>
  );
}

/** Water droplets for Pump tiles / timetable. */
export function IconPump(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 4.5c2.2 2.8 3.8 4.8 3.8 6.8a3.8 3.8 0 1 1-7.6 0c0-2 1.6-4 3.8-6.8Z" />
      <path d="M17 9c1.6 2 2.7 3.4 2.7 4.9a2.7 2.7 0 1 1-5.4 0c0-1.5 1.1-2.9 2.7-4.9Z" />
    </Icon>
  );
}

export function IconSun(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function IconRepeat(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </Icon>
  );
}

export function IconStop(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </Icon>
  );
}

export function IconTemperature(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z" />
    </Icon>
  );
}

export function IconMedication(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </Icon>
  );
}

export function IconWeight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v4" />
      <path d="M6 7h12l-1.5 14H7.5L6 7Z" />
      <path d="M9 11h6" />
    </Icon>
  );
}

export function IconHealth(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 12 4.5 5.5 5.5 0 0 0 5 8.5c0 2.29 1.51 4.04 3 5.5l7 7 4-7Z" />
    </Icon>
  );
}

export function IconStats(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
    </Icon>
  );
}

export function IconExport(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Icon>
  );
}

export function IconGrowth(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M7 20V8M12 20V4M17 20v-6" />
    </Icon>
  );
}

export function IconMilestone(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 2 2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2Z" />
    </Icon>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4M12 18h.01" />
    </Icon>
  );
}

/** App mark for reminder surfaces (branded PNG, not a house/bell glyph). */
export function IconReminders({ size = 20, className }: IconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small brand mark from /public
    <img
      src="/icon-192.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md object-cover", className)}
      aria-hidden
    />
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

export function IconLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

export function IconVillage(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h5v-6h4v6h5V10" />
    </Icon>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </Icon>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3" />
    </Icon>
  );
}

export function IconLocation(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12 5 5L20 7" />
    </Icon>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function IconToday(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </Icon>
  );
}

export function IconInsights(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
    </Icon>
  );
}

export function IconLogPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </Icon>
  );
}

export function IconProfile(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="9" r="4" />
      <path d="M6 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconGrid(props: IconProps) {
  return IconToday(props);
}

export function IconChevronRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function IconDroplet(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12Z" />
    </Icon>
  );
}

export type ActivityType =
  | "feed"
  | "sleep"
  | "nap"
  | "diaper"
  | "pump"
  | "health"
  | "growth"
  | "activity"
  | "moment";

const activityIconMap = {
  feed: IconFeed,
  sleep: IconSleep,
  nap: IconSleep,
  diaper: IconDiaper,
  pump: IconPump,
  health: IconHealth,
  growth: IconGrowth,
  activity: IconActivity,
  moment: IconMoment,
} as const;

export function ActivityIcon({
  type,
  className,
  size = 16,
  strokeWidth,
}: {
  type: ActivityType;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Component = activityIconMap[type];
  return (
    <Component size={size} className={className} strokeWidth={strokeWidth} />
  );
}

export function LetterBadge({
  letter,
  className,
  size = "md",
}: {
  letter: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "w-7 h-7 text-xs"
      : size === "lg"
        ? "w-12 h-12 text-lg"
        : "w-9 h-9 text-sm";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold",
        sizeClass,
        className
      )}
    >
      {letter}
    </span>
  );
}
