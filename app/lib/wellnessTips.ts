export type TipAudience = "baby" | "caregiver";

export interface WellnessTip {
  id: string;
  audience: TipAudience;
  en: string;
  zh: string;
}

/** Gentle, practical reminders — not medical advice. Mixed baby + caregiver. */
export const WELLNESS_TIPS: readonly WellnessTip[] = [
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

/** Local calendar day key, e.g. "2026-09-06" — same tip for all caregivers that day. */
export function getLocalDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Deterministic daily tip index from local date. */
export function getDailyTipIndex(
  tipCount: number = WELLNESS_TIPS.length,
  date: Date = new Date()
): number {
  if (tipCount <= 0) return 0;
  const key = getLocalDayKey(date);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % tipCount;
}

export function getTipAt(index: number): WellnessTip {
  const i = ((index % WELLNESS_TIPS.length) + WELLNESS_TIPS.length) % WELLNESS_TIPS.length;
  return WELLNESS_TIPS[i]!;
}
