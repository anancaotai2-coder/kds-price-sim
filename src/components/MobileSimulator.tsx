"use client";

import { useMemo, useState } from "react";
import {
  Attribute,
  GroupSize,
  LicenseType,
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

// 未回答は null。回答済みかどうかで「次に出す質問」を決める。
interface Answers {
  license: LicenseType | null;
  attribute: Attribute | null;
  hasReferral: boolean | null;
  referralType: ReferralType | null;
  groupSize: GroupSize | null;
  quick: QuickPlan | null;
  moped: boolean | null;
  night: boolean | null;
  safetyPack: boolean | null;
  overLessonCount: number | null;
}

const EMPTY_ANSWERS: Answers = {
  license: null,
  attribute: null,
  hasReferral: null,
  referralType: null,
  groupSize: null,
  quick: null,
  moped: null,
  night: null,
  safetyPack: null,
  overLessonCount: null,
};

type AnswerKey = keyof Answers;

interface QuestionOption {
  value: string | number | boolean;
  label: string;
  sub?: string;
}

interface Question {
  key: AnswerKey;
  title: string;
  description?: string;
  // 結果画面の「回答内容」に出す短い見出し。
  summaryLabel: string;
  options: QuestionOption[];
  // 選択肢が多い質問（時限数など）はグリッドで並べる。
  grid?: boolean;
  // 前の回答によって出す・出さないが変わる質問。
  when?: (a: Answers) => boolean;
}

function buildQuestions(data: PriceData): Question[] {
  const { overLessonChoiceMax, assumedOverLessonCount } = data.anxietyScenario;
  return [
    {
      key: "license",
      title: "取りたい免許はどちらですか？",
      summaryLabel: "免許",
      options: [
        { value: "AT", label: "AT（オートマ）", sub: "多くの方はこちら" },
        { value: "MT", label: "MT（マニュアル）" },
      ],
    },
    {
      key: "attribute",
      title: "あなたは学生ですか？",
      description: "大学・専門学校・高校などに在学中の方は「学生」を選んでください。",
      summaryLabel: "区分",
      options: [
        { value: "student", label: "学生" },
        { value: "general", label: "一般（学生以外）" },
      ],
    },
    {
      key: "hasReferral",
      title: "紹介者はいらっしゃいますか？",
      summaryLabel: "紹介",
      options: [
        { value: true, label: "はい" },
        { value: false, label: "いいえ" },
      ],
    },
    {
      key: "referralType",
      title: "どなたからの紹介ですか？",
      summaryLabel: "紹介の種類",
      when: (a) => a.hasReferral === true,
      options: REFERRAL_TYPES.map(({ id, label }) => ({ value: id, label })),
    },
    {
      key: "groupSize",
      title: "同時に入校する人はいますか？",
      description: "ご友人・ご家族など、同じ時期に一緒に入校する人数（ご自身を含む）を選んでください。",
      summaryLabel: "同時入校",
      options: [
        { value: "none", label: "いない（1人で入校）" },
        { value: "two", label: "2人" },
        { value: "threePlus", label: "3人以上" },
      ],
    },
    {
      key: "quick",
      title: "短期集中で取りたいですか？",
      summaryLabel: "短期集中",
      options: [
        { value: "quick20", label: QUICK_PLAN_LABELS.quick20, sub: "短期集中コース" },
        { value: "quick30", label: QUICK_PLAN_LABELS.quick30, sub: "短期集中コース" },
        { value: "none", label: "特にこだわらない" },
      ],
    },
    {
      key: "moped",
      title: "原付講習も希望しますか？",
      summaryLabel: "原付講習",
      options: [
        { value: true, label: "希望する" },
        { value: false, label: "希望しない" },
      ],
    },
    {
      key: "night",
      title: "夜間に教習を受けたいですか？",
      summaryLabel: "夜間教習",
      options: [
        { value: true, label: "夜間も通いたい" },
        { value: false, label: "日中だけでOK" },
      ],
    },
    {
      key: "safetyPack",
      title: "追加費用も見込んで比較しますか？",
      description:
        "技能教習が延びたり、検定に落ちてしまった場合の追加費用（安心パック・補習料金）も含めた金額で比較できます。",
      summaryLabel: "安心パック",
      options: [
        { value: true, label: "見込んで比較する", sub: "安心パック・補習料金を含める" },
        { value: false, label: "見込まない" },
      ],
    },
    {
      key: "overLessonCount",
      title: "技能教習は何時限まで追加を見込みますか？",
      description: `迷ったら目安の${assumedOverLessonCount}時限を選んでください。`,
      summaryLabel: "追加時限数",
      when: (a) => a.safetyPack === true,
      grid: true,
      options: Array.from({ length: overLessonChoiceMax + 1 }, (_, n) => ({
        value: n,
        label: `${n}`,
        sub: n === assumedOverLessonCount ? "目安" : undefined,
      })),
    },
  ];
}

function optionLabel(q: Question, value: Answers[AnswerKey]): string {
  if (q.key === "overLessonCount") return `${value}時限`;
  return q.options.find((o) => o.value === value)?.label ?? "";
}

type Screen = { kind: "intro" } | { kind: "question"; key: AnswerKey } | { kind: "result" };

export default function MobileSimulator({ data }: { data: PriceData }) {
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [screen, setScreen] = useState<Screen>({ kind: "intro" });

  const questions = useMemo(() => buildQuestions(data), [data]);
  const visible = questions.filter((q) => !q.when || q.when(answers));
  const targetName = data.schools.find((s) => s.isTarget)?.name ?? "";

  // 回答後は「まだ答えていない次の質問」へ進む。戻って答え直した場合も、答え済みの質問は飛ばして元の位置へ戻る。
  const nextScreen = (a: Answers, fromIndex: number): Screen => {
    const list = questions.filter((q) => !q.when || q.when(a));
    const next = list.slice(fromIndex + 1).find((q) => a[q.key] === null);
    return next ? { kind: "question", key: next.key } : { kind: "result" };
  };

  const answer = (q: Question, value: QuestionOption["value"]) => {
    const updated = { ...answers, [q.key]: value };
    setAnswers(updated);
    const index = questions.filter((x) => !x.when || x.when(updated)).findIndex((x) => x.key === q.key);
    setScreen(nextScreen(updated, index));
  };

  const restart = () => {
    setAnswers(EMPTY_ANSWERS);
    setScreen({ kind: "intro" });
  };

  if (screen.kind === "intro") {
    return <Intro targetName={targetName} questionCount={visible.length} onStart={() => setScreen(nextScreen(answers, -1))} />;
  }

  if (screen.kind === "result") {
    return (
      <Result
        data={data}
        answers={answers}
        questions={visible}
        targetName={targetName}
        onEdit={(key) => setScreen({ kind: "question", key })}
        onRestart={restart}
      />
    );
  }

  const index = visible.findIndex((q) => q.key === screen.key);
  const q = visible[index];
  const goBack = () => (index === 0 ? setScreen({ kind: "intro" }) : setScreen({ kind: "question", key: visible[index - 1].key }));

  return (
    <Shell
      targetName={targetName}
      headerRight={
        <button onClick={goBack} className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-500 active:bg-slate-100">
          ‹ 戻る
        </button>
      }
    >
      <div className="mt-2 flex items-baseline justify-between">
        <SectionLabel>QUESTION {String(index + 1).padStart(2, "0")}</SectionLabel>
        <span className="text-xs font-bold text-slate-400">
          <span className="text-orange-500">{index + 1}</span> / {visible.length}
        </span>
      </div>
      <RoadProgress ratio={index / visible.length} />

      <section key={q.key} className="animate-question-in mt-7 flex flex-col">
        <h1 className="text-[22px] font-black leading-snug text-slate-900">{q.title}</h1>
        {q.description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{q.description}</p>}

        <div className={q.grid ? "mt-6 grid grid-cols-4 gap-2" : "mt-6 flex flex-col gap-3"}>
          {q.options.map((o) => {
            const selected = answers[q.key] === o.value;
            const tone = selected
              ? "border-orange-500 bg-orange-50 shadow-orange-100"
              : "border-slate-200 bg-white active:border-orange-300 active:bg-orange-50";
            if (q.grid) {
              return (
                <button
                  key={String(o.value)}
                  onClick={() => answer(q, o.value)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 px-1 text-center shadow-sm transition active:scale-[0.97] ${tone}`}
                >
                  <span className="text-lg font-black text-slate-900">
                    {o.label}
                    <span className="text-xs font-medium text-slate-500">時限</span>
                  </span>
                  {o.sub && <span className="mt-0.5 text-[11px] font-bold text-orange-500">{o.sub}</span>}
                </button>
              );
            }
            return (
              <button
                key={String(o.value)}
                onClick={() => answer(q, o.value)}
                className={`flex items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left shadow-sm transition active:scale-[0.98] ${tone}`}
              >
                <span className="flex-1">
                  <span className="block text-base font-bold text-slate-900">{o.label}</span>
                  {o.sub && <span className="mt-0.5 block text-xs text-slate-500">{o.sub}</span>}
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black ${
                    selected ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 text-transparent"
                  }`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}

// KDS公式サイト（k-ds.net）のヘッダーと同じく、「KDS」マークの横に校名を文字で並べる。
function Logo({ targetName, small = false }: { targetName: string; small?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/kds-logo.webp" alt="KDS" className={small ? "h-5 w-auto" : "h-7 w-auto"} />
      <span className="flex flex-col leading-none">
        <span className={`font-bold tracking-wide text-slate-800 ${small ? "text-[8px]" : "text-[10px]"}`}>
          KUMAMOTO DRIVING SCHOOL
        </span>
        <span className={`mt-0.5 text-slate-600 ${small ? "text-[9px]" : "text-[11px]"}`}>
          {targetName.replace(/^KDS/, "")}
        </span>
      </span>
    </span>
  );
}

// 全画面共通の外枠。白ベースに、淡いオレンジのぼかしを背景の飾りとして置く。
function Shell({
  targetName,
  headerRight,
  children,
}: {
  targetName: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col overflow-hidden bg-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-200/50 blur-3xl" />
        <div className="absolute -left-28 top-1/3 h-72 w-72 rounded-full bg-amber-100/70 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-orange-100/60 blur-3xl" />
      </div>
      <header className="relative z-10 flex items-center justify-between border-b border-slate-100 bg-white/70 px-4 py-3 backdrop-blur">
        <Logo targetName={targetName} />
        {headerRight}
      </header>
      <div className="relative z-10 flex flex-1 flex-col px-5 pb-10 pt-5">{children}</div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold tracking-[0.25em] text-orange-500">{children}</p>;
}

// 蛍光ペンで線を引いたような強調。
function Marker({ children }: { children: React.ReactNode }) {
  return <span className="bg-[linear-gradient(transparent_62%,#fed7aa_62%)] px-0.5">{children}</span>;
}

function CarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 22" className={className} aria-hidden>
      <path
        d="M5 15v-3.5C5 10.1 6.1 9 7.5 9H13l5-5.2C18.6 3.3 19.4 3 20.2 3H31c.8 0 1.6.3 2.2.9L38.5 9h3C43 9 44 10.1 44 11.5V15c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1z"
        fill="#f97316"
      />
      <path d="M15.5 9l4-4.2h5.3V9zM27 4.8h3.8L35.2 9H27z" fill="#fff" opacity=".9" />
      <circle cx="13.5" cy="16" r="3.6" fill="#1e293b" />
      <circle cx="13.5" cy="16" r="1.4" fill="#fff" />
      <circle cx="35.5" cy="16" r="3.6" fill="#1e293b" />
      <circle cx="35.5" cy="16" r="1.4" fill="#fff" />
    </svg>
  );
}

// 進み具合を「道路を走る車」で見せる。
function RoadProgress({ ratio }: { ratio: number }) {
  const percent = Math.min(100, Math.max(0, ratio * 100));
  return (
    <div className="relative mt-3 h-8">
      <div className="absolute inset-x-0 bottom-1 h-2 rounded-full bg-slate-100" />
      <div
        className="absolute bottom-1 left-0 h-2 rounded-full bg-orange-400 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
      <div className="absolute inset-x-1 bottom-[11px] border-t-2 border-dashed border-white/80" />
      <div
        className="absolute bottom-2 -ml-5 transition-all duration-500"
        style={{ left: `${percent}%` }}
      >
        <CarIcon className="h-5 w-10 drop-shadow-sm" />
      </div>
      <span className="absolute -top-0.5 right-0 text-sm" aria-hidden>
        🏁
      </span>
    </div>
  );
}

function Intro({ targetName, questionCount, onStart }: { targetName: string; questionCount: number; onStart: () => void }) {
  const features = [
    `全${questionCount}問前後・約1分で完了`,
    "タップするだけでかんたん回答",
    "学割・紹介割引なども自動で反映",
  ];
  return (
    <Shell targetName={targetName}>
      <div className="mt-8">
        <span className="inline-block rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white">
          質問に答えるだけ、約1分でわかる
        </span>
      </div>
      <h1 className="mt-5 text-[34px] font-black leading-[1.3] tracking-tight text-slate-900">
        <Marker>教習料金</Marker>
        <br />
        シミュレーター
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        あなたの通い方に合わせた料金と、
        <br />
        近隣の自動車学校との比較がわかります。
      </p>

      <ul className="mt-7 space-y-2.5">
        {features.map((text, i) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"
          >
            <span className="text-xs font-black text-orange-500">{String(i + 1).padStart(2, "0")}</span>
            {text}
          </li>
        ))}
      </ul>

      <div className="relative mt-10 h-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 bottom-2 border-t-2 border-dashed border-slate-200" />
        <div className="animate-car-drive absolute bottom-2.5">
          <CarIcon className="h-6 w-12" />
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-500 py-4 text-lg font-black text-white shadow-lg shadow-orange-200 transition active:scale-[0.98] active:bg-orange-600"
        >
          スタート
          <span aria-hidden>→</span>
        </button>
      </div>
    </Shell>
  );
}

function Result({
  data,
  answers,
  questions,
  targetName,
  onEdit,
  onRestart,
}: {
  data: PriceData;
  answers: Answers;
  questions: Question[];
  targetName: string;
  onEdit: (key: AnswerKey) => void;
  onRestart: () => void;
}) {
  const license = answers.license ?? "AT";

  const rows = useMemo(() => {
    const choice: StudentChoice = {
      attribute: answers.attribute ?? "general",
      referralType: answers.hasReferral ? answers.referralType : null,
      groupSize: answers.groupSize ?? "none",
      quick: answers.quick ?? "none",
      moped: answers.moped ?? false,
      night: answers.night ?? false,
      safetyPack: {
        enabled: answers.safetyPack ?? false,
        overLessonCount: answers.overLessonCount ?? data.anxietyScenario.assumedOverLessonCount,
      },
    };
    return data.schools
      .map((school) => ({ school, result: calcSchoolPrice(school, license, choice, data.anxietyScenario) }))
      .sort((a, b) => a.result.total - b.result.total || Number(b.school.isTarget) - Number(a.school.isTarget));
  }, [data, answers, license]);

  const target = rows.find((r) => r.school.isTarget) ?? rows[0];
  const others = rows.filter((r) => r !== target);
  const maxSaving = Math.max(0, ...others.map((r) => r.result.total - target.result.total));
  const isCheapest = others.every((r) => r.result.total >= target.result.total);
  const discounts = target.result.breakdown.filter((item) => item.amount < 0);
  const charges = target.result.breakdown.filter((item) => item.amount >= 0);
  const discountTotal = -discounts.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Shell targetName={targetName}>
      <div className="animate-question-in flex flex-col gap-6">
        <div className="mt-3">
          <SectionLabel>RESULT</SectionLabel>
          <h1 className="mt-2 text-[26px] font-black leading-snug text-slate-900">
            あなたの<Marker>教習料金</Marker>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {license === "AT" ? "AT（オートマ）" : "MT（マニュアル）"}・回答内容にもとづく試算です
          </p>
        </div>

        <section className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-orange-100 ring-1 ring-orange-200">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
          <div className="px-5 pb-5 pt-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white">当校</span>
              <p className="text-sm font-bold text-slate-700">{target.school.name}</p>
            </div>
            <p className="mt-3 text-[44px] font-black leading-none tracking-tight text-slate-900">
              {target.result.total.toLocaleString("ja-JP")}
              <span className="ml-1 text-lg font-bold">円</span>
            </p>
            {isCheapest && maxSaving > 0 && (
              <p className="mt-4 inline-block rounded-full bg-orange-500 px-4 py-1.5 text-sm font-black text-white">
                近隣校より最大 {formatYen(maxSaving)} お得！
              </p>
            )}
            {isCheapest && maxSaving === 0 && others.length > 0 && (
              <p className="mt-4 inline-block rounded-full bg-orange-500 px-4 py-1.5 text-sm font-black text-white">
                近隣校と同額で最安
              </p>
            )}

            {discounts.length > 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-orange-300 bg-orange-50/70 px-4 py-3">
                <div className="flex justify-between text-sm font-bold text-orange-700">
                  <span>適用される割引</span>
                  <span>−{formatYen(discountTotal)}</span>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-orange-700">
                  {discounts.map((item, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{item.label}</span>
                      <span className="whitespace-nowrap">−{formatYen(-item.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer py-1 text-sm font-bold text-orange-600">料金の内訳を見る</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {charges.map((item, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="whitespace-nowrap">+{formatYen(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </details>

            <Notes notes={target.result.notes} />
          </div>
        </section>

        {others.length > 0 && (
          <section>
            <SectionLabel>COMPARE</SectionLabel>
            <h2 className="mb-3 mt-1 text-lg font-black text-slate-900">近隣校との比較（安い順）</h2>
            <ol className="flex flex-col gap-2.5">
              {rows.map(({ school, result }, i) => {
                const diff = result.total - target.result.total;
                const isTarget = school.id === target.school.id;
                return (
                  <li
                    key={school.id}
                    className={`rounded-2xl px-4 py-3 shadow-sm ring-1 ${
                      isTarget ? "bg-orange-50 ring-2 ring-orange-400" : "bg-white ring-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                          i === 0 ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {school.name}
                          {isTarget && <span className="ml-1 text-xs text-orange-600">（当校）</span>}
                        </p>
                        {!isTarget && diff !== 0 && (
                          <p className="text-xs text-slate-500">
                            当校より{formatYen(Math.abs(diff))}{diff > 0 ? "高い" : "安い"}
                          </p>
                        )}
                        {!isTarget && diff === 0 && <p className="text-xs text-slate-500">当校と同額</p>}
                      </div>
                      <p className="whitespace-nowrap text-base font-black text-slate-900">{formatYen(result.total)}</p>
                    </div>
                    {!isTarget && (
                      <details className="mt-1 pl-10">
                        <summary className="cursor-pointer text-xs font-bold text-orange-600">内訳を見る</summary>
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                          {result.breakdown.map((item, j) => (
                            <li key={j} className={`flex justify-between gap-2 ${item.amount < 0 ? "text-orange-700" : ""}`}>
                              <span>{item.label}</span>
                              <span className="whitespace-nowrap">
                                {item.amount < 0 ? `−${formatYen(-item.amount)}` : `+${formatYen(item.amount)}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <Notes notes={result.notes} />
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-black text-slate-800">回答内容</h2>
          <p className="mt-0.5 text-xs text-slate-400">タップすると回答を変更できます</p>
          <ul className="mt-2 divide-y divide-slate-100">
            {questions.map((q) => (
              <li key={q.key}>
                <button onClick={() => onEdit(q.key)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm">
                  <span className="text-slate-500">{q.summaryLabel}</span>
                  <span className="font-bold text-slate-900">
                    {optionLabel(q, answers[q.key])} <span className="text-orange-500">›</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <button
          onClick={onRestart}
          className="w-full rounded-full border-2 border-orange-500 bg-white py-3.5 font-black text-orange-600 transition active:bg-orange-50"
        >
          最初からやり直す
        </button>

        <div className="flex flex-col items-center gap-2 pt-2">
          <Logo targetName={targetName} small />
          <p className="text-xs text-slate-400">最終更新: {new Date(data.updatedAt).toLocaleString("ja-JP")}</p>
        </div>
      </div>
    </Shell>
  );
}

function Notes({ notes }: { notes: string[] }) {
  const unique = [...new Set(notes)];
  if (unique.length === 0) return null;
  return (
    <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-500">
      {unique.map((note, i) => (
        <li key={i}>{note}</li>
      ))}
    </ul>
  );
}
