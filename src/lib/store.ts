import { promises as fs } from "fs";
import path from "path";
import {
  ApplicabilityFlags,
  PriceData,
  ReferralAmounts,
  ReferralType,
  School,
  SchoolCampaign,
  blankReferralAmounts,
  defaultApplicability,
} from "./pricing";

type LegacyCampaign = Omit<SchoolCampaign, "id" | "enabled" | "applicability">;
// 旧形式の紹介割引（学校ごとに自由な名前で登録していたもの）。
type LegacyReferralDiscount = { id: string; name: string; amount: number };

// 旧形式の紹介割引の名前から、固定の紹介種類を推定するためのキーワード。
const LEGACY_REFERRAL_KEYWORDS: [ReferralType, string[]][] = [
  ["circle", ["サークル"]],
  ["friend", ["友達", "友人"]],
  ["family", ["家族"]],
  ["coop", ["生協"]],
  ["greenCampus", ["グリーン"]],
];

const DATA_FILE = path.join(process.cwd(), "data", "schools.json");
const BLOB_PATHNAME = "schools.json";
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

const SEED_DATA: PriceData = {
  schools: [
    {
      id: "kds",
      name: "KDS熊本ドライビングスクール",
      isTarget: true,
      isPlaceholder: true,
      hideName: false,
      pricing: {
        baseAT: 335000,
        baseMT: 353000,
        nightSurcharge: 27000,
        nightFreeForStudents: true,
        quick20Surcharge: 22000,
        quick30Surcharge: 22000,
        safeCourseSurcharge: 0,
        overLessonFee: 6000,
        skillRetestFee: 5500,
        graduationRetestFee: 5500,
        provisionalWrittenRetestFee: 1800,
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
    },
    {
      id: "school-a",
      name: "近隣A自動車学校",
      isTarget: false,
      isPlaceholder: true,
      hideName: true,
      pricing: {
        baseAT: 340000,
        baseMT: 358000,
        nightSurcharge: 25000,
        nightFreeForStudents: true,
        quick20Surcharge: 20000,
        quick30Surcharge: 20000,
        safeCourseSurcharge: 0,
        overLessonFee: 6000,
        skillRetestFee: 6000,
        graduationRetestFee: 6000,
        provisionalWrittenRetestFee: 2000,
        freeOverLessonCount: 3,
        freeSkillRetestCount: 1,
        freeGraduationRetestCount: 1,
        freeProvisionalWrittenRetestCount: 1,
        studentDiscount: 10000,
        studentDiscountApplicability: defaultApplicability(),
        groupDiscount2: 0,
        groupDiscount3Plus: 0,
        mopedFee: 0,
        pricingNote: "",
        discountNote: "",
      },
      campaigns: [],
      referralAmounts: blankReferralAmounts(),
    },
    {
      id: "school-b",
      name: "近隣B自動車学校",
      isTarget: false,
      isPlaceholder: true,
      hideName: true,
      pricing: {
        baseAT: 330000,
        baseMT: 348000,
        nightSurcharge: 26000,
        nightFreeForStudents: true,
        quick20Surcharge: 25000,
        quick30Surcharge: 25000,
        safeCourseSurcharge: 0,
        overLessonFee: 5500,
        skillRetestFee: 5000,
        graduationRetestFee: 5000,
        provisionalWrittenRetestFee: 1500,
        freeOverLessonCount: 0,
        freeSkillRetestCount: 0,
        freeGraduationRetestCount: 0,
        freeProvisionalWrittenRetestCount: 0,
        studentDiscount: 8000,
        studentDiscountApplicability: defaultApplicability(),
        groupDiscount2: 0,
        groupDiscount3Plus: 0,
        mopedFee: 0,
        pricingNote: "",
        discountNote: "",
      },
      campaigns: [],
      referralAmounts: blankReferralAmounts(),
    },
  ],
  anxietyScenario: {
    overLessonChoiceMax: 20,
    assumedOverLessonCount: 12,
    assumedSkillRetestCount: 1,
    assumedGraduationRetestCount: 1,
    assumedProvisionalWrittenRetestCount: 1,
  },
  updatedAt: new Date().toISOString(),
};

async function ensureDataFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(SEED_DATA, null, 2), "utf-8");
  }
}

async function getDataFromFile(): Promise<PriceData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as PriceData;
}

async function saveDataToFile(data: PriceData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Vercelのサーバーレス環境ではファイルシステムへの書き込みが永続化されないため、
// BLOB_READ_WRITE_TOKEN が設定されている本番環境では Vercel Blob を使う。
async function getDataFromBlob(): Promise<PriceData> {
  const { head, BlobNotFoundError } = await import("@vercel/blob");
  try {
    const info = await head(BLOB_PATHNAME);
    // Vercel Blobの公開URLはCDNでキャッシュされるため、保存直後に古い内容が返ることがある。
    // クエリ文字列を変えて別リソース扱いにし、CDNキャッシュを回避する。
    const res = await fetch(`${info.url}?v=${info.uploadedAt.getTime()}`, { cache: "no-store" });
    return (await res.json()) as PriceData;
  } catch (e) {
    // 未保存の初回のみ初期値を返す。それ以外の一時的な失敗で既存データを初期値で上書きしないよう、書き込みはしない。
    if (e instanceof BlobNotFoundError) return SEED_DATA;
    throw e;
  }
}

async function saveDataToBlob(data: PriceData): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATHNAME, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// 古い保存データに新しいフィールドが無い場合の後方互換用の補完。
// キャンペーン・学割の適用先が未設定の場合は defaultApplicability()（一般プランのみ）になる。
// これは「最短・安心パックには適用しない」という仕様変更の意図どおりの挙動。
function normalize(data: PriceData): PriceData {
  return {
    ...data,
    anxietyScenario: {
      ...data.anxietyScenario,
      overLessonChoiceMax: Math.max(
        data.anxietyScenario.overLessonChoiceMax ?? 10,
        data.anxietyScenario.assumedOverLessonCount
      ),
    },
    schools: data.schools.map((saved) => {
      // 旧形式（1校1キャンペーン）の `campaign` を `campaigns` 配列へ移行する。
      const {
        campaign: legacy,
        referralDiscounts: legacyReferrals,
        ...school
      } = saved as School & { campaign?: LegacyCampaign; referralDiscounts?: LegacyReferralDiscount[] };
      // 旧形式の「短期集中コース加算」（クイック20・30共通）は、両方の初期値として引き継ぐ。
      const { shortTermSurcharge: legacyShortTerm, ...pricing } = school.pricing as School["pricing"] & {
        shortTermSurcharge?: number;
      };
      const campaigns: SchoolCampaign[] = (
        school.campaigns ??
        (legacy && (legacy.label || legacy.freeCouponCount || legacy.freeRetestCount || legacy.extraDiscount)
          ? [{ id: `${school.id}-campaign-1`, enabled: true, ...legacy, applicability: defaultApplicability() }]
          : [])
      ).map((c) => ({ ...c, applicability: normalizeApplicability(c.applicability), note: c.note ?? "" }));
      return {
        ...school,
        campaigns,
        referralAmounts: school.referralAmounts
          ? { ...blankReferralAmounts(), ...school.referralAmounts }
          : migrateLegacyReferrals(legacyReferrals ?? []),
        hideName: school.hideName ?? !school.isTarget,
        pricing: {
          ...pricing,
          nightFreeForStudents: pricing.nightFreeForStudents ?? true,
          quick20Surcharge: pricing.quick20Surcharge ?? legacyShortTerm ?? 0,
          quick30Surcharge: pricing.quick30Surcharge ?? legacyShortTerm ?? 0,
          safeCourseSurcharge: school.pricing.safeCourseSurcharge ?? 0,
          studentDiscountApplicability: normalizeApplicability(school.pricing.studentDiscountApplicability),
          groupDiscount2: school.pricing.groupDiscount2 ?? 0,
          groupDiscount3Plus: school.pricing.groupDiscount3Plus ?? 0,
          mopedFee: school.pricing.mopedFee ?? 0,
          pricingNote: school.pricing.pricingNote ?? "",
          discountNote: school.pricing.discountNote ?? "",
        },
      };
    }),
  };
}

// 名前から種類が推定できない旧データは引き継がれない（管理画面で入力し直す）。
function migrateLegacyReferrals(legacy: LegacyReferralDiscount[]): ReferralAmounts {
  const amounts = blankReferralAmounts();
  for (const r of legacy) {
    const match = LEGACY_REFERRAL_KEYWORDS.find(([, words]) => words.some((w) => r.name.includes(w)));
    if (match && !amounts[match[0]]) amounts[match[0]] = r.amount;
  }
  return amounts;
}

function normalizeApplicability(flags?: Partial<ApplicabilityFlags>): ApplicabilityFlags {
  return flags ? { ...defaultApplicability(), ...flags } : defaultApplicability();
}

export async function getData(): Promise<PriceData> {
  const data = useBlob ? await getDataFromBlob() : await getDataFromFile();
  return normalize(data);
}

export async function saveData(data: PriceData): Promise<void> {
  data.updatedAt = new Date().toISOString();
  return useBlob ? saveDataToBlob(data) : saveDataToFile(data);
}
