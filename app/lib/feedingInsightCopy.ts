/**
 * Pediatrician-in-clinic voice for Insights feeding trends.
 * Both languages are written here on purpose so the wording stays accurate.
 * Numbers come only from logged feeds. No diagnosis, no health claims.
 */

export type FeedDirection = "up" | "down" | "same" | "na";

export type FeedingWindow = {
  feedCount: number;
  bottleCount: number;
  breastCount: number;
  totalMl: number;
  formulaMl: number;
  breastmilkMl: number;
  untypedMl: number;
  avgMl: number | null;
  avgIntervalMinutes: number | null;
  avgDurationMinutes: number | null;
};

export type FeedingInsightInput = {
  language: "en" | "zh";
  mode: "daily" | "weekly";
  /** Daily mode only: the selected day is the Singapore today. */
  isToday: boolean;
  current: FeedingWindow;
  previous: FeedingWindow;
  countDirection: FeedDirection;
  volumeDirection: FeedDirection;
  intervalDirection: FeedDirection;
};

type Pattern =
  | "insufficient"
  | "noPrior"
  | "steady"
  | "closerHigher"
  | "widerLower"
  | "closerLower"
  | "widerHigher";

export function buildFeedingInsight(input: FeedingInsightInput): string {
  const pattern = patternOf(input);
  const { language } = input;
  if (pattern === "insufficient") {
    return language === "zh"
      ? "目前记下的喂奶还不够，我还看不出趋势。等记下几次之后，我可以比较奶量和间隔。"
      : "There is not enough logged yet for me to talk about a trend. Once a few feeds are in, I can compare the amount and the gaps.";
  }

  const sentences = [
    leadSentence(input, pattern),
    numbersSentence(input),
    comparisonSentence(input, pattern),
  ].filter((sentence): sentence is string => Boolean(sentence));

  return language === "zh" ? sentences.join("") : sentences.join(" ");
}

function patternOf(input: FeedingInsightInput): Pattern {
  if (input.current.feedCount < 2) return "insufficient";
  if (input.previous.feedCount < 2) return "noPrior";
  const shorter = input.intervalDirection === "down";
  const longer = input.intervalDirection === "up";
  const moreVolume = input.volumeDirection === "up";
  const lessVolume = input.volumeDirection === "down";
  if (shorter && moreVolume) return "closerHigher";
  if (longer && lessVolume) return "widerLower";
  if (shorter && lessVolume) return "closerLower";
  if (longer && moreVolume) return "widerHigher";
  return "steady";
}

function previousLabel(input: FeedingInsightInput): string {
  if (input.language === "zh") {
    if (input.mode === "weekly") return "上一周";
    return input.isToday ? "昨天" : "前一天";
  }
  if (input.mode === "weekly") return "last week";
  return input.isToday ? "yesterday" : "the day before";
}

function whenLabel(input: FeedingInsightInput): string {
  if (input.language === "zh") {
    if (input.mode === "weekly") return "这周";
    return input.isToday ? "今天" : "那一天";
  }
  if (input.mode === "weekly") return "this week";
  return input.isToday ? "today" : "for that day";
}

function spanWord(input: FeedingInsightInput): "day" | "week" {
  return input.mode === "weekly" ? "week" : "day";
}

function leadSentence(input: FeedingInsightInput, pattern: Pattern): string {
  const prev = previousLabel(input);
  const when = whenLabel(input);
  if (input.language === "zh") {
    if (pattern === "noPrior") {
      if (input.mode === "weekly") {
        return "上一周记下的还不够比较，所以这里只讲这一周。";
      }
      return input.isToday
        ? "昨天记下的还不够比较，所以这里只讲今天。"
        : "前一天记下的还不够比较，所以这里只讲这一天。";
    }
    if (pattern === "closerHigher") {
      return `喂奶间隔比${prev}更近一些，奶量也更多。`;
    }
    if (pattern === "widerLower") {
      return `喂奶间隔比${prev}更开一些，奶量也少了一些。`;
    }
    if (pattern === "closerLower") {
      return `喂奶间隔比${prev}更近一些，不过奶量少了一些。`;
    }
    if (pattern === "widerHigher") {
      return `间隔比${prev}稍长一些，奶量也多了一些。`;
    }
    return `他${when}的喂养看起来比较稳定。`;
  }

  if (pattern === "noPrior") {
    if (input.mode === "weekly") {
      return "There is not enough from last week to compare yet, so this is just this week.";
    }
    return input.isToday
      ? "There is not enough from yesterday to compare yet, so this is just today."
      : "There is not enough from the day before to compare yet, so this is just that day.";
  }
  if (pattern === "closerHigher") {
    return `Feeds were a bit closer together than ${prev}, and the volume was higher.`;
  }
  if (pattern === "widerLower") {
    return `Feeds were a bit further apart than ${prev}, and the volume was lower.`;
  }
  if (pattern === "closerLower") {
    return `Feeds were a bit closer together than ${prev}, but the volume was lower.`;
  }
  if (pattern === "widerHigher") {
    return `The gaps were a little longer than ${prev}, and the amount was higher.`;
  }
  return `His feeding looks steady ${when}.`;
}

function roundedMl(value: number): number {
  return Math.round(value);
}

function numbersSentence(input: FeedingInsightInput): string {
  const window = input.current;
  const count = window.feedCount;
  const split = window.bottleCount > 0 && window.breastCount > 0;
  const total = roundedMl(window.totalMl);
  const formula = roundedMl(window.formulaMl);
  const breastmilk = roundedMl(window.breastmilkMl);
  const untyped = roundedMl(window.untypedMl);
  const avg = window.avgMl == null ? null : roundedMl(window.avgMl);
  const hasMl = total > 0 && avg != null;
  const duration =
    window.avgDurationMinutes == null
      ? null
      : formatDurationWords(input.language, window.avgDurationMinutes);

  if (input.language === "zh") {
    const splitBit = split
      ? `，奶瓶${window.bottleCount}次、亲喂${window.breastCount}次`
      : "";
    const durationBit = duration ? `，有记下时长的平均大约${duration}` : "";
    if (!hasMl || avg == null) {
      return `他吃了${count}次${splitBit}${durationBit}。`;
    }
    const each = split ? `平均每瓶大约${avg}毫升` : `平均每次大约${avg}毫升`;
    if (untyped === 0 && formula > 0 && breastmilk > 0) {
      return `他吃了${count}次${splitBit}，一共大约${total}毫升，其中配方奶${formula}毫升、母乳${breastmilk}毫升，${each}${durationBit}。`;
    }
    if (untyped === 0 && formula > 0 && breastmilk === 0) {
      return `他吃了${count}次${splitBit}，配方奶一共大约${total}毫升，${each}${durationBit}。`;
    }
    if (untyped === 0 && breastmilk > 0 && formula === 0) {
      return `他吃了${count}次${splitBit}，母乳一共大约${total}毫升，${each}${durationBit}。`;
    }
    return `他吃了${count}次${splitBit}，一共大约${total}毫升，${each}${durationBit}。`;
  }

  const splitBit = split
    ? `, ${window.bottleCount} from a bottle and ${window.breastCount} at the breast`
    : "";
  const durationBit = duration
    ? `, and when a time was written down they lasted about ${duration}`
    : "";
  if (!hasMl || avg == null) {
    return `He took ${count} feeds${splitBit}${durationBit}.`;
  }
  const each = split ? `roughly ${avg} ml a bottle` : `roughly ${avg} ml each`;
  if (untyped === 0 && formula > 0 && breastmilk > 0) {
    return `He took ${count} feeds${splitBit}, about ${total} ml in all, ${formula} ml formula and ${breastmilk} ml breast milk, ${each}${durationBit}.`;
  }
  if (untyped === 0 && formula > 0 && breastmilk === 0) {
    return `He took ${count} feeds${splitBit}, about ${total} ml of formula in all, ${each}${durationBit}.`;
  }
  if (untyped === 0 && breastmilk > 0 && formula === 0) {
    return `He took ${count} feeds${splitBit}, about ${total} ml of breast milk in all, ${each}${durationBit}.`;
  }
  return `He took ${count} feeds${splitBit}, about ${total} ml in all, ${each}${durationBit}.`;
}

function comparisonSentence(
  input: FeedingInsightInput,
  pattern: Pattern
): string | null {
  const interval = input.current.avgIntervalMinutes;
  const words =
    interval == null ? null : formatDurationWords(input.language, interval);
  const prev = previousLabel(input);

  if (pattern === "closerHigher" || pattern === "widerLower") {
    return reassurance(input, pattern, words);
  }

  if (pattern === "noPrior") {
    if (!words) return null;
    return input.language === "zh"
      ? `间隔平均大约${words}。`
      : `The gaps averaged about ${words}.`;
  }

  return steadyComparison(input, words, prev);
}

function reassurance(
  input: FeedingInsightInput,
  pattern: "closerHigher" | "widerLower",
  words: string | null
): string {
  const week = spanWord(input) === "week";
  if (input.language === "zh") {
    const dayBit = week ? "这一周" : "这一天";
    const feel = pattern === "closerHigher" ? "比较足" : "量比较少";
    if (!words) {
      return `这是${feel}的${week ? "一周" : "一天"}，单凭${dayBit}还看不出突然的变化。`;
    }
    return `间隔平均大约${words}，这是${feel}的${week ? "一周" : "一天"}，单凭${dayBit}还看不出突然的变化。`;
  }

  const span = week ? "week" : "day";
  const feel = pattern === "closerHigher" ? "fuller" : "lighter";
  if (!words) {
    return `That is a ${feel} ${span}, not a sudden change by itself.`;
  }
  return `The gaps averaged about ${words} — a ${feel} ${span}, not a sudden change by itself.`;
}

function steadyComparison(
  input: FeedingInsightInput,
  words: string | null,
  prev: string
): string | null {
  if (input.language === "zh") {
    const pieces: string[] = [];
    if (input.countDirection === "up") pieces.push(`次数比${prev}多一些`);
    if (input.countDirection === "down") pieces.push(`次数比${prev}少一些`);
    if (input.volumeDirection === "up") pieces.push(`奶量比${prev}多一些`);
    if (input.volumeDirection === "down") pieces.push(`奶量比${prev}少一些`);
    if (words) {
      pieces.push(`间隔平均大约${words}${zhIntervalTail(input.intervalDirection, prev)}`);
    }
    if (pieces.length === 0) return `和${prev}差不多。`;
    return `${pieces.join("，")}。`;
  }

  const pieces: string[] = [];
  if (input.countDirection === "up") {
    pieces.push(`there were more feeds than ${prev}`);
  }
  if (input.countDirection === "down") {
    pieces.push(`there were fewer feeds than ${prev}`);
  }
  if (input.volumeDirection === "up") {
    pieces.push(`the amount was higher than ${prev}`);
  }
  if (input.volumeDirection === "down") {
    pieces.push(`the amount was lower than ${prev}`);
  }
  if (words) {
    pieces.push(
      `the gaps averaged about ${words}${enIntervalTail(input.intervalDirection, prev)}`
    );
  }
  if (pieces.length === 0) return `About the same as ${prev}.`;
  const body = pieces.join(", and ");
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}

function enIntervalTail(direction: FeedDirection, prev: string): string {
  if (direction === "up") return `, a little longer than ${prev}`;
  if (direction === "down") return `, a little shorter than ${prev}`;
  if (direction === "same") return `, about the same as ${prev}`;
  return "";
}

function zhIntervalTail(direction: FeedDirection, prev: string): string {
  if (direction === "up") return `，比${prev}稍长一些`;
  if (direction === "down") return `，比${prev}稍短一些`;
  if (direction === "same") return `，和${prev}差不多`;
  return "";
}

export function formatDurationWords(
  language: "en" | "zh",
  minutes: number
): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rem = total % 60;
  if (language === "zh") {
    if (hours === 0) return `${rem}分钟`;
    if (rem === 0) return `${hours}小时`;
    return `${hours}小时${rem}分钟`;
  }
  const hourWord = hours === 1 ? "hour" : "hours";
  const minuteWord = rem === 1 ? "minute" : "minutes";
  if (hours === 0) return `${rem} ${minuteWord}`;
  if (rem === 0) return `${hours} ${hourWord}`;
  return `${hours} ${hourWord} ${rem} ${minuteWord}`;
}
