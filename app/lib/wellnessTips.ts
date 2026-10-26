import {
  getAgeBand,
  isValidBirthDate,
  type AgeBandId,
} from "@/app/lib/babyAge";
import {
  DEFAULT_TRACKER_TIMEZONE,
  getDateKeyInZone,
} from "../../convex/lib/dayBounds";

export type TipAudience = "baby" | "caregiver";

export interface WellnessTip {
  id: string;
  audience: TipAudience;
  en: string;
  zh: string;
}

/** Gentle, practical reminders — not medical advice. Used when birth date is unknown. */
export const GENERIC_WELLNESS_TIPS: readonly WellnessTip[] = [
  {
    id: "baby-tummy-time",
    audience: "baby",
    en: "A few short tummy-time sessions while baby is awake and supervised can help build strength and curiosity.",
    zh: "宝宝清醒且有人看护时，几次短短的趴趴时间，有助于力量和探索能力的发展。",
  },
  {
    id: "caregiver-hydrate",
    audience: "caregiver",
    en: "Keep a water bottle nearby. A few sips between feeds or changes is real self-care.",
    zh: "身边放一瓶水。喂奶或换尿布的间隙喝几口，就是实实在在的自我照顾。",
  },
  {
    id: "baby-skin-to-skin",
    audience: "baby",
    en: "Skin-to-skin time — chest to chest, calm and warm — can soothe baby and deepen connection for any caregiver.",
    zh: "肌肤接触——胸口贴胸口、安静又温暖——能安抚宝宝，也加深任何照护者与宝宝的联结。",
  },
  {
    id: "caregiver-rest",
    audience: "caregiver",
    en: "When baby rests, rest if you can. Even ten quiet minutes helps more than powering through.",
    zh: "宝宝休息时，能歇就歇。哪怕安静十分钟，也比硬撑着更有用。",
  },
  {
    id: "baby-feeding-cues",
    audience: "baby",
    en: "Watch early feeding cues — rooting, hand-to-mouth, fussing — before crying. Responsive feeding builds trust.",
    zh: "留意早期的觅食信号——转头、把手往嘴边送、不安——不必等到大哭。回应式喂养建立信任。",
  },
  {
    id: "caregiver-ask-help",
    audience: "caregiver",
    en: "Asking for help is strength, not failure. Your village is here so you do not have to carry it alone.",
    zh: "开口求助是力量，不是失败。村庄在这里，正是为了让你不必一个人扛。",
  },
  {
    id: "baby-calm-space",
    audience: "baby",
    en: "Soft light, steady voices, and fewer sudden noises help baby feel safe in a busy day.",
    zh: "柔和的光线、平稳的声音、少一些突然的噪音，能让宝宝在忙碌的一天里更有安全感。",
  },
  {
    id: "caregiver-walk",
    audience: "caregiver",
    en: "A short walk — alone or with baby — can reset your nervous system when the day feels heavy.",
    zh: "短短散个步——独自或带着宝宝——能在沉重的日子里帮神经系统换换气。",
  },
  {
    id: "baby-talk-sing",
    audience: "baby",
    en: "Talk, hum, or sing while you care for baby. Your voice is familiar comfort and early language practice.",
    zh: "照护时说说、哼哼或唱唱。你的声音是熟悉的安慰，也是早期语言练习。",
  },
  {
    id: "caregiver-eat",
    audience: "caregiver",
    en: "Eat something simple when you can. Fueling yourself is part of caring for baby.",
    zh: "能吃就吃点简单的。照顾好自己，也是在照顾宝宝。",
  },
  {
    id: "baby-wet-diapers",
    audience: "baby",
    en: "Noticing wet diapers through the day is a gentle way to stay in tune with baby's hydration and comfort.",
    zh: "留意一天中的湿尿布，是温和地关注宝宝水分与舒适的方式。",
  },
  {
    id: "caregiver-enough",
    audience: "caregiver",
    en: "You are doing enough. Showing up with care — even on imperfect days — is what matters.",
    zh: "你已经做得够多了。带着关心出现——哪怕日子不完美——才是最重要的。",
  },
  {
    id: "baby-village-trust",
    audience: "baby",
    en: "Baby thrives with consistent love from many hands. Trusting other caregivers is part of the village.",
    zh: "宝宝在许多人的稳定关爱里茁壮成长。信任其他照护者，正是「众人拾柴」的一部分。",
  },
  {
    id: "caregiver-handoff",
    audience: "caregiver",
    en: "Hand off without guilt when you can. Resting so you can return present is good care for everyone.",
    zh: "能交接时，不必内疚。歇一歇再回来全心投入，对大家都是好的照护。",
  },
  {
    id: "baby-eye-contact",
    audience: "baby",
    en: "Soft eye contact during feeds or quiet moments helps baby feel seen and secure.",
    zh: "喂奶或安静时刻里温柔的眼神交流，能让宝宝感到被看见、被安稳托住。",
  },
  {
    id: "caregiver-breathe",
    audience: "caregiver",
    en: "One slow breath before the next task. Small pauses protect your patience and presence.",
    zh: "下一件事之前，先慢慢吸一口气。小小的停顿，守护你的耐心与在场。",
  },
] as const;

/** @deprecated Use GENERIC_WELLNESS_TIPS — kept for call sites that expect WELLNESS_TIPS. */
export const WELLNESS_TIPS = GENERIC_WELLNESS_TIPS;

/** Age-specific cues — warm, observational, never diagnostic. */
const AGE_BAND_TIPS: Record<AgeBandId, readonly WellnessTip[]> = {
  newborn: [
    {
      id: "nb-cluster",
      audience: "baby",
      en: "Cluster feeds and short naps are common early on. Following baby's rhythm matters more than a perfect schedule.",
      zh: "早期常见频繁喂奶和短睡。跟着宝宝的节奏，比追求完美作息更重要。",
    },
    {
      id: "nb-wake-windows",
      audience: "baby",
      en: "Newborns often stay happily awake only a short while. Quiet cuddles and dim light can ease the next settle.",
      zh: "新生儿清醒愉快的时间往往很短。安静抱抱、柔和光线，有助于下一次入睡。",
    },
    {
      id: "nb-skin",
      audience: "baby",
      en: "Skin-to-skin and a calm hold help regulate baby's temperature, breathing, and sense of safety.",
      zh: "肌肤接触和安静的怀抱，有助于稳定宝宝的体温、呼吸和安全感。",
    },
    {
      id: "nb-caregiver",
      audience: "caregiver",
      en: "These early days are intense. Tag in another caregiver when you can — recovery is part of caring for baby.",
      zh: "最初几天很辛苦。能交接就交接——好好恢复，也是在照顾宝宝。",
    },
  ],
  weeks_0_4: [
    {
      id: "w04-gaze",
      audience: "baby",
      en: "Baby may hold your gaze a little longer now. Soft faces and gentle talk are rich early “conversation.”",
      zh: "宝宝可能更能对上你的目光了。温柔的脸庞和轻声说话，都是丰富的早期「对话」。",
    },
    {
      id: "w04-tummy",
      audience: "baby",
      en: "Brief supervised tummy time on a firm surface builds neck strength — stop when baby protests.",
      zh: "在坚固平面上短短的趴趴（有人看护），有助于颈部力量——宝宝抗拒时就停下。",
    },
    {
      id: "w04-day-night",
      audience: "baby",
      en: "Daytime light and nighttime dimness gently nudge day–night rhythms. No rush — it unfolds gradually.",
      zh: "白天多些光线、夜里偏暗，能温和引导昼夜节律。不必着急，它会慢慢成形。",
    },
    {
      id: "w04-caregiver",
      audience: "caregiver",
      en: "If feeds feel relentless, jot a quick note in the log so the next caregiver knows what just happened.",
      zh: "若喂奶感觉停不下来，在记录里随手记一笔，方便下一位照护者接得上。",
    },
  ],
  weeks_4_8: [
    {
      id: "w48-smile",
      audience: "baby",
      en: "You may catch early social smiles — a flicker of recognition. Celebrate the moment; timing varies widely.",
      zh: "你可能捕捉到早期的社交笑——一闪而过的认出你。好好庆祝；出现时间因宝宝而异。",
    },
    {
      id: "w48-track",
      audience: "baby",
      en: "Slow-moving faces or a soft toy may hold baby's interest as tracking skills grow.",
      zh: "缓慢移动的脸庞或柔软玩具，可能随着注视能力发展而更吸引宝宝。",
    },
    {
      id: "w48-hands",
      audience: "baby",
      en: "Hands finding the mouth is soothing exploration, not “bad habits.” Offer a clean finger or soft cloth if helpful.",
      zh: "手往嘴里送是安抚式探索，不是「坏习惯」。需要时可以给干净的手指或柔软布巾。",
    },
    {
      id: "w48-caregiver",
      audience: "caregiver",
      en: "Growth spurts can mean hungrier days. Sharing the pattern in the village log helps everyone stay patient.",
      zh: "猛长期可能更饿。在村庄记录里分享这个规律，大家都会更有耐心。",
    },
  ],
  weeks_8_12: [
    {
      id: "w812-social-smile",
      audience: "baby",
      en: "Around now, many babies offer clearer social smiles — lighting up when they see a familiar face. Enjoy the connection; every baby’s timeline differs.",
      zh: "大约此时，许多宝宝会露出更明显的社交笑——见到熟悉的脸就亮起来。享受这份联结；每位宝宝的节奏都不同。",
    },
    {
      id: "w812-tracking",
      audience: "baby",
      en: "Watch for smoother eye tracking: following a face or toy as it moves slowly side to side. Quiet play is enough practice.",
      zh: "留意更顺畅的视线追随：慢慢左右移动的脸或玩具。安静玩耍就够练习了。",
    },
    {
      id: "w812-head",
      audience: "baby",
      en: "On tummy time, you may see steadier head lifts and short holds. Brief, happy sessions beat long forced ones.",
      zh: "趴趴时，你可能看到更稳的抬头和短短维持。愉快的短时间，胜过勉强的长时间。",
    },
    {
      id: "w812-sounds",
      audience: "baby",
      en: "Coos, gurgles, and back-and-forth sounds are early conversation. Pause and answer — baby is practicing turn-taking.",
      zh: "咕咕声、咯咯声和一来一往的声音，是早期对话。停一停再回应——宝宝在练习轮流。",
    },
    {
      id: "w812-hands-midline",
      audience: "baby",
      en: "Hands meeting at the middle of the body, or batting at a dangling toy, show growing coordination.",
      zh: "双手在身体中间相碰，或拍打悬挂玩具，都显示协调能力在成长。",
    },
    {
      id: "w812-caregiver",
      audience: "caregiver",
      en: "If something about development worries you, note what you see and ask your pediatrician — they know your baby’s story.",
      zh: "若发育方面有担心，记下你看到的，再问问儿科医生——他们了解你家宝宝的故事。",
    },
  ],
  months_3_6: [
    {
      id: "m36-roll",
      audience: "baby",
      en: "Rolling one way (or starting to) often appears in this window. Keep play spaces safe and never leave baby unattended on a raised surface.",
      zh: "这个阶段常开始会翻身（或朝一个方向翻）。活动空间要安全，高处切勿无人看护。",
    },
    {
      id: "m36-reach",
      audience: "baby",
      en: "Reaching, grasping, and bringing toys to the mouth are big learning loops — offer a few simple, safe objects.",
      zh: "伸手、抓握、把玩具送进嘴里，是重要的学习循环——给几件简单安全的物品即可。",
    },
    {
      id: "m36-laugh",
      audience: "baby",
      en: "Laughs, squeals, and stronger preference for familiar people are lovely social milestones when they show up.",
      zh: "笑声、尖叫，以及对熟人更明显的偏爱，出现时都是可爱的社交里程碑。",
    },
    {
      id: "m36-caregiver",
      audience: "caregiver",
      en: "Routines may shift as naps lengthen. Update the village log so caregivers expect the new rhythm.",
      zh: "小睡变长时，作息可能跟着变。更新村庄记录，让照护者跟上新节奏。",
    },
  ],
  months_6_9: [
    {
      id: "m69-sit",
      audience: "baby",
      en: "Sitting with less support, pivoting to look around, and transferring toys hand-to-hand are common curiosities now.",
      zh: "更少支撑地坐着、转身环顾、玩具双手传递，都是此刻常见的探索。",
    },
    {
      id: "m69-solids",
      audience: "baby",
      en: "If solids have started, follow your clinician’s guidance and note reactions in the log for the whole village.",
      zh: "若已添加辅食，请遵循医生建议，并在记录里写下反应，方便整个村庄知情。",
    },
    {
      id: "m69-babble",
      audience: "baby",
      en: "Babbling strings (“ba-ba,” “da-da”) invite reply. Narrate the day — language grows in conversation.",
      zh: "连续的咿呀（「爸爸」「大大」）邀请你回应。边做边说——语言在对话里生长。",
    },
    {
      id: "m69-caregiver",
      audience: "caregiver",
      en: "Mobility may be around the corner. A quick safety sweep of the floor helps every caregiver feel ready.",
      zh: "活动能力可能即将增强。快速检查地面安全，让每位照护者都更安心。",
    },
  ],
  months_9_12: [
    {
      id: "m912-pull",
      audience: "baby",
      en: "Pulling to stand, cruising furniture, or determined crawling — celebrate progress without comparing timelines.",
      zh: "扶站、扶走，或坚定地爬——为进步庆祝，不必比较时间表。",
    },
    {
      id: "m912-pincer",
      audience: "baby",
      en: "A growing pincer grasp (thumb and finger) makes finger foods and tiny discoveries exciting — always supervise.",
      zh: "逐渐出现的捏取（拇指与食指）让手指食物和小发现更有趣——务必有人看护。",
    },
    {
      id: "m912-words",
      audience: "baby",
      en: "Waves, claps, or a first clear word may appear. Respond with delight; pressure is unnecessary.",
      zh: "挥手、拍手或第一个清晰的词可能出现。用开心回应即可，不必施加压力。",
    },
    {
      id: "m912-caregiver",
      audience: "caregiver",
      en: "Separation feelings can intensify. Consistent goodbyes and reunions across caregivers build security.",
      zh: "分离情绪可能加重。照护者之间一致的道别与重逢，能建立安全感。",
    },
  ],
  months_12_plus: [
    {
      id: "m12-walk",
      audience: "baby",
      en: "First steps, or more confident walking, often unfold after the first birthday — cheer the tries, not just the milestones.",
      zh: "周岁后常迎来第一步或更稳的行走——为尝试喝彩，不只为里程碑。",
    },
    {
      id: "m12-words",
      audience: "baby",
      en: "A growing word bank and simple gestures help baby be understood. Narrate choices; keep screens secondary to people.",
      zh: "词汇和简单手势增多，宝宝更容易被理解。描述选择；人与人的互动优先于屏幕。",
    },
    {
      id: "m12-play",
      audience: "baby",
      en: "Simple pretend play and stacking games feed imagination. Follow baby’s lead for a few undistracted minutes.",
      zh: "简单的假装游戏和叠叠乐滋养想象力。跟着宝宝的节奏，专心陪几分钟。",
    },
    {
      id: "m12-caregiver",
      audience: "caregiver",
      en: "Toddlers test limits. Agree on a few shared village phrases so caregivers respond in a similar calm way.",
      zh: "学步期会试探界限。约定几句村庄共用的说法，让照护者以相似的平静方式回应。",
    },
  ],
};

/** A few caregiver tips always mixed into age pools so rotation stays balanced. */
const SHARED_CAREGIVER_TIPS: readonly WellnessTip[] = [
  GENERIC_WELLNESS_TIPS.find((t) => t.id === "caregiver-hydrate")!,
  GENERIC_WELLNESS_TIPS.find((t) => t.id === "caregiver-rest")!,
  GENERIC_WELLNESS_TIPS.find((t) => t.id === "caregiver-ask-help")!,
  GENERIC_WELLNESS_TIPS.find((t) => t.id === "caregiver-handoff")!,
  GENERIC_WELLNESS_TIPS.find((t) => t.id === "caregiver-enough")!,
];

export function getTodayDateKey(now: Date = new Date()): string {
  return getDateKeyInZone(now.getTime(), DEFAULT_TRACKER_TIMEZONE);
}

export function resolveAgeBand(
  birthDate: string | undefined,
  now: Date = new Date()
): AgeBandId | null {
  if (!birthDate || !isValidBirthDate(birthDate)) return null;
  return getAgeBand(birthDate, getTodayDateKey(now));
}

/** Tips available for today's context (age pool or generic fallback). */
export function getTipsForContext(
  birthDate: string | undefined,
  now: Date = new Date()
): readonly WellnessTip[] {
  const band = resolveAgeBand(birthDate, now);
  if (!band) return GENERIC_WELLNESS_TIPS;

  const ageTips = AGE_BAND_TIPS[band];
  const seen = new Set(ageTips.map((t) => t.id));
  const extras = SHARED_CAREGIVER_TIPS.filter((t) => !seen.has(t.id));
  return [...ageTips, ...extras];
}

/** Local calendar day key, e.g. "2026-09-06" — same tip for all caregivers that day. */
export function getLocalDayKey(date: Date = new Date()): string {
  return getTodayDateKey(date);
}

/** Deterministic daily tip index from local date. */
export function getDailyTipIndex(
  tipCount: number,
  date: Date = new Date()
): number {
  if (tipCount <= 0) return 0;
  const key = getLocalDayKey(date);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  // Mix in tipCount so different pools don't always land on index 0 the same way.
  hash = (hash * 31 + tipCount) >>> 0;
  return hash % tipCount;
}

export function getTipAt(
  tips: readonly WellnessTip[],
  index: number
): WellnessTip {
  if (tips.length === 0) {
    return GENERIC_WELLNESS_TIPS[0]!;
  }
  const i = ((index % tips.length) + tips.length) % tips.length;
  return tips[i]!;
}
