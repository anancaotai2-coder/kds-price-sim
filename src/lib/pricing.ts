export type SchoolId = string;
// 料金計算上のベースプラン。クイック20・30を選ぶと "fast"（短期集中）、選ばなければ "normal"。
export type PatternId = "fast" | "normal";
export type QuickPlan = "none" | "quick20" | "quick30";
export type LicenseType = "AT" | "MT";
export type Attribute = "general" | "student";

// キャンペーン・学割の適用先。「最短プラン」「一般プラン」「安心パック利用時」を
// それぞれ独立に ON/OFF できる。安心パックは最短・一般どちらにも付けられる横断オプションなので、
// 「ベースプランが一致」しているかどうかと「安心パックの有無」の両方をこのフラグで判定する。
export interface ApplicabilityFlags {
  fast: boolean;
  normal: boolean;
  safetyPack: boolean;
}

export function isApplicable(
  flags: ApplicabilityFlags,
  pattern: PatternId,
  safetyPackEnabled: boolean
): boolean {
  const matchesBasePlan = pattern === "fast" ? flags.fast : flags.normal;
  if (!matchesBasePlan) return false;
  if (safetyPackEnabled && !flags.safetyPack) return false;
  return true;
}

export function defaultApplicability(): ApplicabilityFlags {
  // 既定では「一般プラン・安心パックなし」の時だけ適用される（最短・安心パックには効かない）。
  return { fast: false, normal: true, safetyPack: false };
}

export interface SchoolPricing {
  baseAT: number;
  baseMT: number;
  nightSurcharge: number;
  shortTermSurcharge: number;
  safeCourseSurcharge: number;
  overLessonFee: number;
  skillRetestFee: number;
  graduationRetestFee: number;
  provisionalWrittenRetestFee: number;
  freeOverLessonCount: number;
  freeSkillRetestCount: number;
  freeGraduationRetestCount: number;
  freeProvisionalWrittenRetestCount: number;
  studentDiscount: number;
  studentDiscountApplicability: ApplicabilityFlags;
  // 同時入校割引（1人あたりの割引額）。生徒が選んだ同時入校の人数に応じて適用される。
  groupDiscount2: number;
  groupDiscount3Plus: number;
  // 原付講習の加算額。生徒がオプションで「原付講習を希望する」を選んだときに加算される。
  mopedFee: number;
  // 「基本料金」ブロック全体に対する注釈（例：表示価格は税込です、など）。
  pricingNote: string;
  // 「割引額」ブロック（学生割引＋同時入校割引＋紹介割引）全体に対する注釈。
  discountNote: string;
}

export type GroupSize = "none" | "two" | "threePlus";

export interface SchoolCampaign {
  id: string;
  enabled: boolean;
  label: string;
  freeCouponCount: number;
  freeRetestCount: number;
  extraDiscount: number;
  applicability: ApplicabilityFlags;
  note: string;
}

// 紹介の種類は全校共通で固定。割引額は学校ごとに設定する（0円ならその学校では割引なし）。
export type ReferralType = "circle" | "friend" | "family" | "coop" | "greenCampus";

export const REFERRAL_TYPES: { id: ReferralType; label: string }[] = [
  { id: "circle", label: "サークルの紹介" },
  { id: "friend", label: "友達からの紹介" },
  { id: "family", label: "家族からの紹介" },
  { id: "coop", label: "生協（学生生協）からの紹介" },
  { id: "greenCampus", label: "グリーンキャンパスからの紹介" },
];

export type ReferralAmounts = Record<ReferralType, number>;

export function blankReferralAmounts(): ReferralAmounts {
  return { circle: 0, friend: 0, family: 0, coop: 0, greenCampus: 0 };
}

export interface School {
  id: SchoolId;
  name: string;
  isTarget: boolean;
  isPlaceholder: boolean;
  hideName: boolean;
  pricing: SchoolPricing;
  campaigns: SchoolCampaign[];
  referralAmounts: ReferralAmounts;
}

export interface AnxietyScenario {
  // 安心パックの「技能教習 追加時限数」は生徒が選べる。0〜この上限までの選択肢を出す。
  overLessonChoiceMax: number;
  assumedOverLessonCount: number;
  assumedSkillRetestCount: number;
  assumedGraduationRetestCount: number;
  assumedProvisionalWrittenRetestCount: number;
}

export interface PriceData {
  schools: School[];
  anxietyScenario: AnxietyScenario;
  updatedAt: string;
}

export function createBlankSchool(id: string): School {
  return {
    id,
    name: "新しい学校",
    isTarget: false,
    isPlaceholder: true,
    hideName: true,
    pricing: {
      baseAT: 0,
      baseMT: 0,
      nightSurcharge: 0,
      shortTermSurcharge: 0,
      safeCourseSurcharge: 0,
      overLessonFee: 0,
      skillRetestFee: 0,
      graduationRetestFee: 0,
      provisionalWrittenRetestFee: 0,
      freeOverLessonCount: 0,
      freeSkillRetestCount: 0,
      freeGraduationRetestCount: 0,
      freeProvisionalWrittenRetestCount: 0,
      studentDiscount: 0,
      studentDiscountApplicability: defaultApplicability(),
      groupDiscount2: 0,
      groupDiscount3Plus: 0,
      mopedFee: 0,
      pricingNote: "",
      discountNote: "",
    },
    campaigns: [],
    referralAmounts: blankReferralAmounts(),
  };
}

export function createBlankCampaign(id: string): SchoolCampaign {
  return {
    id,
    enabled: true,
    label: "",
    freeCouponCount: 0,
    freeRetestCount: 0,
    extraDiscount: 0,
    applicability: defaultApplicability(),
    note: "",
  };
}

export interface BreakdownItem {
  label: string;
  amount: number;
}

export interface PatternResult {
  license: LicenseType;
  total: number;
  breakdown: BreakdownItem[];
  notes: string[];
}

export interface SafetyPackChoice {
  enabled: boolean;
  overLessonCount: number;
}

// 生徒画面で選ばれた条件（AT/MT以外）。
export interface StudentChoice {
  attribute: Attribute;
  referralType: ReferralType | null;
  groupSize: GroupSize;
  quick: QuickPlan;
  moped: boolean;
  night: boolean;
  safetyPack: SafetyPackChoice;
}

export function calcSchoolPrice(
  school: School,
  license: LicenseType,
  choice: StudentChoice,
  scenario: AnxietyScenario
): PatternResult {
  const { attribute, referralType, groupSize, quick, moped, night, safetyPack } = choice;
  const pattern: PatternId = quick === "none" ? "normal" : "fast";
  const p = school.pricing;
  const safetyOn = safetyPack.enabled;
  const activeCampaigns = school.campaigns.filter(
    (c) => c.enabled && isApplicable(c.applicability, pattern, safetyOn)
  );
  const couponCount = activeCampaigns.reduce((sum, c) => sum + c.freeCouponCount, 0);
  const retestCount = activeCampaigns.reduce((sum, c) => sum + c.freeRetestCount, 0);
  const breakdown: BreakdownItem[] = [];

  const base = license === "AT" ? p.baseAT : p.baseMT;
  breakdown.push({ label: "基本料金", amount: base });

  if (quick !== "none" && p.shortTermSurcharge) {
    breakdown.push({
      label: `短期集中コース加算（${QUICK_PLAN_LABELS[quick]}）`,
      amount: p.shortTermSurcharge,
    });
  }

  // 安心パックを「付けた場合」と「付けず都度の補習料金で払う場合」の追加費用を作る。
  // 安心パックに含まれる無料回数（freeXxxCount）は、付けた場合にだけ効く。
  const buildSafetyItems = (withPack: boolean): BreakdownItem[] => {
    const items: BreakdownItem[] = [];
    if (withPack && p.safeCourseSurcharge) {
      items.push({ label: "安心パック加算", amount: p.safeCourseSurcharge });
    }

    const freeOver = (withPack ? p.freeOverLessonCount : 0) + couponCount;
    const overNeeded = Math.max(0, safetyPack.overLessonCount - freeOver);
    if (overNeeded > 0) {
      items.push({
        label: withPack ? `技能オーバー教習 ${overNeeded}回分` : `補習料金 ${overNeeded}時限分`,
        amount: overNeeded * p.overLessonFee,
      });
    }

    const freeSkill = (withPack ? p.freeSkillRetestCount : 0) + retestCount;
    const skillNeeded = Math.max(0, scenario.assumedSkillRetestCount - freeSkill);
    if (skillNeeded > 0) {
      items.push({ label: `修了検定再受験 ${skillNeeded}回分`, amount: skillNeeded * p.skillRetestFee });
    }

    const freeGrad = (withPack ? p.freeGraduationRetestCount : 0) + retestCount;
    const gradNeeded = Math.max(0, scenario.assumedGraduationRetestCount - freeGrad);
    if (gradNeeded > 0) {
      items.push({ label: `卒業検定再受験 ${gradNeeded}回分`, amount: gradNeeded * p.graduationRetestFee });
    }

    const freeWritten = withPack ? p.freeProvisionalWrittenRetestCount : 0;
    const writtenNeeded = Math.max(0, scenario.assumedProvisionalWrittenRetestCount - freeWritten);
    if (writtenNeeded > 0) {
      items.push({ label: `仮免学科再受験 ${writtenNeeded}回分`, amount: writtenNeeded * p.provisionalWrittenRetestFee });
    }
    return items;
  };

  if (safetyOn) {
    const withPack = buildSafetyItems(true);
    // 安心パック料金が設定されている学校は、安い方を自動で表示する（同額なら補習料金）。
    // 安心パック料金が無い学校は、従来どおり「付けた場合」の計算のみ。
    if (p.safeCourseSurcharge > 0) {
      const payPerLesson = buildSafetyItems(false);
      const sum = (items: BreakdownItem[]) => items.reduce((s, i) => s + i.amount, 0);
      breakdown.push(...(sum(withPack) < sum(payPerLesson) ? withPack : payPerLesson));
    } else {
      breakdown.push(...withPack);
    }
  }

  if (moped && p.mopedFee) {
    breakdown.push({ label: "原付講習", amount: p.mopedFee });
  }

  if (night && p.nightSurcharge) {
    breakdown.push({ label: "夜間料金加算", amount: p.nightSurcharge });
  }

  if (
    attribute === "student" &&
    p.studentDiscount &&
    isApplicable(p.studentDiscountApplicability, pattern, safetyOn)
  ) {
    breakdown.push({ label: "学生割引", amount: -p.studentDiscount });
  }

  if (groupSize !== "none") {
    const groupAmount = groupSize === "two" ? p.groupDiscount2 : p.groupDiscount3Plus;
    if (groupAmount) {
      breakdown.push({
        label: `同時入校割引（${groupSize === "two" ? "2人" : "3人以上"}）`,
        amount: -groupAmount,
      });
    }
  }

  for (const c of activeCampaigns) {
    if (c.extraDiscount) {
      breakdown.push({ label: c.label || "キャンペーン割引", amount: -c.extraDiscount });
    }
  }

  if (referralType) {
    const amount = school.referralAmounts[referralType];
    if (amount) {
      const label = REFERRAL_TYPES.find((r) => r.id === referralType)!.label;
      breakdown.push({ label: `紹介割引（${label}）`, amount: -amount });
    }
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  // 今の選択で実際に料金へ反映されているブロックの注釈だけを集める。
  const notes: string[] = [];
  if (p.pricingNote) notes.push(p.pricingNote);
  if (p.discountNote) notes.push(p.discountNote);
  for (const c of activeCampaigns) {
    if (c.note) notes.push(c.note);
  }

  return { license, total, breakdown, notes };
}

export const QUICK_PLAN_LABELS: Record<Exclude<QuickPlan, "none">, string> = {
  quick20: "クイック20",
  quick30: "クイック30",
};
