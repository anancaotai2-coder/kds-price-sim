export type SchoolId = string;
// 料金計算上のベースプラン。クイック20・30を選ぶと "fast"（短期集中）、選ばなければ "normal"。
export type PatternId = "fast" | "normal";
export type QuickPlan = "none" | "quick20" | "quick30";
export type LicenseType = "AT" | "MT";
// 生徒の区分。高校生・大学生・専門学生は「学生」として学生割引・学生の夜間料金無料の対象になる。
export type Attribute = "highSchool" | "university" | "vocational" | "worker";

export const ATTRIBUTES: { id: Attribute; label: string }[] = [
  { id: "highSchool", label: "高校生" },
  { id: "university", label: "大学生" },
  { id: "vocational", label: "専門学生" },
  { id: "worker", label: "社会人・その他" },
];

export function isStudent(attribute: Attribute): boolean {
  return attribute !== "worker";
}

// キャンペーンの対象者。区分ごとに ON/OFF する。
export type AudienceFlags = Record<Attribute, boolean>;

export function allAudiences(): AudienceFlags {
  return { highSchool: true, university: true, vocational: true, worker: true };
}

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
  // 学生は夜間料金が無料になる学校かどうか。
  nightFreeForStudents: boolean;
  // 短期集中コース（クイック20・クイック30）の加算額。
  quick20Surcharge: number;
  quick30Surcharge: number;
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
  // 対象者（高校生・大学生など）。対象外の区分の生徒にはこのキャンペーンは適用されない。
  audiences: AudienceFlags;
  note: string;
}

// 紹介の種類は全校共通で固定。割引額は学校ごとに設定する（0円ならその学校では割引なし）。
export type ReferralType = "circle" | "friend" | "family" | "coop" | "greenCampus";

export const REFERRAL_TYPES: { id: ReferralType; label: string }[] = [
  { id: "circle", label: "サークルの紹介" },
  { id: "friend", label: "友達からの紹介" },
  { id: "family", label: "家族からの紹介" },
  { id: "coop", label: "大学生協からの紹介" },
  { id: "greenCampus", label: "グリーンキャンパスからの紹介" },
];

export type ReferralAmounts = Record<ReferralType, number>;

export function blankReferralAmounts(): ReferralAmounts {
  return { circle: 0, friend: 0, family: 0, coop: 0, greenCampus: 0 };
}

// 大学生協・グリーンキャンパスからの紹介は、単なる割引額ではなく「特典」を自由に複数書ける。
// 特典ごとに割引額（0円なら料金に影響しない、表示のみの特典）を持つ。
// これらの種類では referralAmounts は使わず、referralPerks の割引額の合計が料金に反映される。
export type PerkReferralType = "coop" | "greenCampus";

export const PERK_REFERRAL_TYPES: PerkReferralType[] = ["coop", "greenCampus"];

export function isPerkReferralType(type: ReferralType): type is PerkReferralType {
  return (PERK_REFERRAL_TYPES as ReferralType[]).includes(type);
}

export interface ReferralPerk {
  id: string;
  text: string;
  // この特典で料金から差し引く額。0円なら表示のみ（電子マネー・お買い物券など）。
  discount: number;
  // 追加技能教習のチケット回数。教習料金からは引かず、「技能オーバー1回」の単価×回数を
  // 「◯円分お得」として特典欄にだけ表示する。
  lessonTickets: number;
}

// 生徒画面に出す紹介特典1件分。value は「◯円分お得」として見せる金額（割引額＋チケット換算額）。
export interface PerkResult {
  text: string;
  discount: number;
  ticketValue: number;
}

export type ReferralPerks = Record<PerkReferralType, ReferralPerk[]>;

export function blankReferralPerks(): ReferralPerks {
  return { coop: [], greenCampus: [] };
}

// 当校（KDS）の初期設定。
export function defaultTargetReferralPerks(): ReferralPerks {
  return {
    coop: [
      { id: "coop-perk-1", text: "1万円の割引", discount: 10000, lessonTickets: 0 },
      { id: "coop-perk-2", text: "技能保証の乗り放題（追加費用なし）", discount: 0, lessonTickets: 0 },
      { id: "coop-perk-3", text: "2万円分の電子マネーをチャージ", discount: 0, lessonTickets: 0 },
    ],
    greenCampus: [
      { id: "green-perk-1", text: "2万円の割引", discount: 20000, lessonTickets: 0 },
      { id: "green-perk-2", text: "グリーンキャンパスお買い物券1万円分", discount: 0, lessonTickets: 0 },
      { id: "green-perk-3", text: "追加技能教習チケット5回分サービス", discount: 0, lessonTickets: 5 },
    ],
  };
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
  referralPerks: ReferralPerks;
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
      nightFreeForStudents: true,
      quick20Surcharge: 0,
      quick30Surcharge: 0,
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
    referralPerks: blankReferralPerks(),
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
    audiences: allAudiences(),
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
  // 紹介特典（大学生協・グリーンキャンパス）の一覧。割引額のある特典も含めて全部並べる。
  perks: PerkResult[];
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
    (c) => c.enabled && c.audiences[attribute] && isApplicable(c.applicability, pattern, safetyOn)
  );
  const couponCount = activeCampaigns.reduce((sum, c) => sum + c.freeCouponCount, 0);
  const retestCount = activeCampaigns.reduce((sum, c) => sum + c.freeRetestCount, 0);
  const breakdown: BreakdownItem[] = [];

  const base = license === "AT" ? p.baseAT : p.baseMT;
  breakdown.push({ label: "基本料金", amount: base });

  if (quick !== "none") {
    const quickAmount = quick === "quick20" ? p.quick20Surcharge : p.quick30Surcharge;
    if (quickAmount) {
      breakdown.push({ label: `短期集中コース加算（${QUICK_PLAN_LABELS[quick]}）`, amount: quickAmount });
    }
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
    // 学生の夜間料金無料は、加算を消すのではなく同額の割引として見せる（割引欄に表示されるように）。
    if (isStudent(attribute) && p.nightFreeForStudents) {
      breakdown.push({ label: "学生 夜間料金無料", amount: -p.nightSurcharge });
    }
  }

  if (
    isStudent(attribute) &&
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

  const perks: PerkResult[] = [];
  if (referralType && isPerkReferralType(referralType)) {
    for (const perk of school.referralPerks[referralType]) {
      if (!perk.text.trim() && !perk.discount && !perk.lessonTickets) continue;
      const text = perk.text.trim() || "紹介特典";
      // チケットは教習料金（total）には含めず、お得額としてだけ見せる。
      perks.push({ text, discount: perk.discount, ticketValue: perk.lessonTickets * p.overLessonFee });
      if (perk.discount) {
        breakdown.push({ label: `紹介特典：${text}`, amount: -perk.discount });
      }
    }
  } else if (referralType) {
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

  return { license, total, breakdown, notes, perks };
}

export const QUICK_PLAN_LABELS: Record<Exclude<QuickPlan, "none">, string> = {
  quick20: "クイック20",
  quick30: "クイック30",
};
