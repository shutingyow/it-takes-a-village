/** Milk feeds drive the next-feed clock. Solids are logged separately. */
export type FeedType = "breast" | "bottle" | "solids";

export function isMilkFeed(type: string): type is "breast" | "bottle" {
  return type === "breast" || type === "bottle";
}
