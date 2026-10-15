"use client";

import { useMemo, useState } from "react";
import {
  Attribute,
  GroupSize,
  PriceData,
  QUICK_PLAN_LABELS,
  QuickPlan,
  REFERRAL_TYPES,
  ReferralType,
  StudentChoice,
  calcSchoolPrice,
} from "@/lib/pricing";

function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

const QUICK_ORDER: Exclude<QuickPlan, "none">[] = ["quick20", "quick30"];

export default function StudentSimulator({ data }: { data: PriceData }) {
  const [attribute, setAttribute] = useState<Attribute>("general");
  const [hasReferral, setHasReferral] = useState(false);
  const [referralType, setReferralType] = useState<ReferralType | null>(null);
  const [groupSize, setGroupSize] = useState<GroupSize>("none");
  const [quick, setQuick] = useState<QuickPlan>("none");
  const [moped, setMoped] = useState(false);
  const [night, setNight] = useState(false);
  const [safetyPackEnabled, setSafetyPackEnabled] = useState(false);
  const [overLessonCount, setOverLessonCount] = useState(data.anxietyScenario.assumedOverLessonCount);

  const choice: StudentChoice = useMemo(
    () => ({
      attribute,
      referralType: hasReferral ? referralType : null,
      groupSize,
      quick,
      moped,
      night,
      safetyPack: { enabled: safetyPackEnabled, overLessonCount },
    }),
    [attribute, hasReferral, referralType, groupSize, quick, moped, night, safetyPackEnabled, overLessonCount]
  );

  const rows = useMemo(() => {
    const results = data.schools.map((school) => ({
      school,
      at: calcSchoolPrice(school, "AT", choice, data.anxietyScenario),
      mt: calcSchoolPrice(school, "MT", choice, data.anxietyScenario),
    }));

    const minAt = Math.min(...results.map((r) => r.at.total));
    const minMt = Math.min(...results.map((r) => r.mt.total));

    return results
      .map((r) => ({ ...r, isCheapestAt: r.at.total === minAt, isCheapestMt: r.mt.total === minMt }))
      .sort((a, b) => Number(b.school.isTarget) - Number(a.school.isTarget));
  }, [data, choice]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-2xl bg-emerald-900 px-6 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-emerald-300">
          {data.schools.find((s) => s.isTarget)?.name ?? ""}
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">料金シミュレーター</h1>
        <p className="mt-2 text-sm text-emerald-100">
          あなたの通い方に合わせて、近隣校との料金を比較できます。
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-semibold text-slate-700">1. あなたについて教えてください</p>
        <SegmentedControl
          options={[
            ["general", "一般"],
            ["student", "学生"],
          ]}
          value={attribute}
          onChange={setAttribute}
        />

        <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">2. 紹介者はいらっしゃいますか？</p>
        <SegmentedControl
          options={[
            [false, "いいえ"],
            [true, "はい"],
          ]}
          value={hasReferral}
          onChange={setHasReferral}
        />
        {hasReferral && (
          <div className="mt-3 flex flex-wrap gap-2">
            {REFERRAL_TYPES.map(({ id, label }) => (
              <ChipButton key={id} active={referralType === id} onClick={() => setReferralType(id)}>
                {label}
              </ChipButton>
            ))}
          </div>
        )}

        <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">3. 同時入校される方はいますか？</p>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          ご友人・ご家族など、同じ時期に一緒に入校する人数（ご自身を含む）を選んでください。
        </p>
        <SegmentedControl
          options={[
            ["none", "無し"],
            ["two", "2人"],
            ["threePlus", "3人以上"],
          ]}
          value={groupSize}
          onChange={setGroupSize}
        />

        <p className="mb-3 mt-6 text-sm font-semibold text-slate-700">4. オプションをつけられますか？</p>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          当てはまるものをすべて選んでください（クイック20・クイック30はどちらか一方のみ）。
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_ORDER.map((id) => (
            <ChipButton key={id} active={quick === id} onClick={() => setQuick(quick === id ? "none" : id)}>
              {QUICK_PLAN_LABELS[id]}
            </ChipButton>
          ))}
          <ChipButton active={moped} onClick={() => setMoped(!moped)}>
            原付講習を希望する
          </ChipButton>
          <ChipButton active={night} onClick={() => setNight(!night)}>
            夜間教習を希望する
          </ChipButton>
        </div>

        <p className="mb-3 mt-5 text-sm font-semibold text-slate-700">安心パックをつけますか？</p>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          技能教習が延びたり、検定に落ちてしまった場合の追加費用も見込んだ金額で比較したいときに選んでください。
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedControl
            options={[
              [false, "つけない"],
              [true, "つける"],
            ]}
            value={safetyPackEnabled}
            onChange={setSafetyPackEnabled}
          />

          {safetyPackEnabled && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              技能教習は何時限まで追加を見込みますか？
              <select
                value={overLessonCount}
                onChange={(e) => setOverLessonCount(Number(e.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              >
                {Array.from({ length: data.anxietyScenario.overLessonChoiceMax + 1 }, (_, i) => i).map((n) => (
                  <option key={n} value={n}>
                    {n}時限
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {rows.map(({ school, at, mt, isCheapestAt, isCheapestMt }) => (
          <article
            key={school.id}
            className={`rounded-2xl p-5 shadow-sm ring-1 transition ${
              school.isTarget
                ? "bg-emerald-50 ring-2 ring-emerald-700"
                : "bg-white ring-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {school.isTarget && (
                <span className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white">
                  当校
                </span>
              )}
              <h2 className="text-lg font-bold text-slate-900">{school.name}</h2>
              {school.isPlaceholder && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  仮データ
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <PriceBlock label="AT（オートマ）" total={at.total} isCheapest={isCheapestAt} breakdown={at.breakdown} />
              <PriceBlock label="MT（マニュアル）" total={mt.total} isCheapest={isCheapestMt} breakdown={mt.breakdown} />
            </div>

            {(() => {
              const notes = [...new Set([...at.notes, ...mt.notes])];
              return notes.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
                  {notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              ) : null;
            })()}
          </article>
        ))}
      </section>

      <p className="text-center text-xs text-slate-400">
        最終更新: {new Date(data.updatedAt).toLocaleString("ja-JP")}
      </p>
    </main>
  );
}

function SegmentedControl<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-200 sm:inline-flex">
      {options.map(([optionValue, label]) => (
        <button
          key={String(optionValue)}
          onClick={() => onChange(optionValue)}
          className={`flex-1 px-4 py-2 text-sm font-medium transition sm:flex-none ${
            value === optionValue ? "bg-emerald-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-emerald-700 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
      }`}
    >
      {children}
    </button>
  );
}

function PriceBlock({
  label,
  total,
  isCheapest,
  breakdown,
}: {
  label: string;
  total: number;
  isCheapest: boolean;
  breakdown: { label: string; amount: number }[];
}) {
  // 割引（マイナスの行）は最初から見える形で出し、それ以外は「内訳を見る」の中に入れる。
  const discounts = breakdown.filter((item) => item.amount < 0);
  const charges = breakdown.filter((item) => item.amount >= 0);

  return (
    <div className="rounded-xl bg-white/70 p-4 ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {isCheapest && (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">
            最安
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{formatYen(total)}</p>

      {discounts.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg bg-orange-50 px-3 py-2 text-xs">
          {discounts.map((item, i) => (
            <li key={i} className="flex justify-between gap-2 font-medium text-orange-700">
              <span>{item.label}</span>
              <span className="whitespace-nowrap">−{formatYen(-item.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-emerald-700">内訳を見る</summary>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {charges.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>{item.label}</span>
              <span>+{formatYen(item.amount)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
