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
        onEdit={(key) => setScreen({ kind: "question", key })}
        onRestart={restart}
      />
    );
  }

  const index = visible.findIndex((q) => q.key === screen.key);
  const q = visible[index];
  const goBack = () => (index === 0 ? setScreen({ kind: "intro" }) : setScreen({ kind: "question", key: visible[index - 1].key }));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col bg-white px-4 pb-8 pt-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <button onClick={goBack} className="-ml-2 rounded-lg px-2 py-2 font-medium text-orange-600 active:bg-orange-50">
          ‹ 戻る
        </button>
        <span className="font-semibold">
          <span className="text-orange-600">Q{index + 1}</span> / {visible.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-300"
          style={{ width: `${(index / visible.length) * 100}%` }}
        />
      </div>

      <section key={q.key} className="animate-question-in mt-8 flex flex-col">
        <h1 className="text-xl font-bold leading-snug text-slate-900">{q.title}</h1>
        {q.description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{q.description}</p>}

        <div className={q.grid ? "mt-6 grid grid-cols-4 gap-2" : "mt-6 flex flex-col gap-3"}>
          {q.options.map((o) => {
            const selected = answers[q.key] === o.value;
            return (
              <button
                key={String(o.value)}
                onClick={() => answer(q, o.value)}
                className={`rounded-2xl border-2 text-left transition active:scale-[0.98] ${
                  q.grid ? "flex aspect-square flex-col items-center justify-center px-1 text-center" : "px-5 py-4"
                } ${
                  selected
                    ? "border-orange-500 bg-orange-50"
                    : "border-slate-200 bg-white active:border-orange-300 active:bg-orange-50"
                }`}
              >
                <span className={`block font-bold text-slate-900 ${q.grid ? "text-lg" : "text-base"}`}>
                  {o.label}
                  {q.grid && <span className="text-xs font-medium text-slate-500">時限</span>}
                </span>
                {o.sub && (
                  <span className={`mt-0.5 block text-xs ${q.grid ? "font-bold text-orange-600" : "text-slate-500"}`}>
                    {o.sub}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Intro({ targetName, questionCount, onStart }: { targetName: string; questionCount: number; onStart: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col bg-orange-600 px-6 pb-10 pt-16 text-white">
      <p className="text-xs font-semibold tracking-widest text-orange-100">{targetName}</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight">
        教習料金シミュレーター
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-orange-50">
        質問に答えるだけで、あなたの通い方に合わせた料金と、近隣校との比較がわかります。
      </p>
      <ul className="mt-8 space-y-3 text-sm">
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 font-bold">✓</span>
          全{questionCount}問前後・約1分
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 font-bold">✓</span>
          タップするだけで回答できます
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 font-bold">✓</span>
          学割・紹介割引なども自動で反映
        </li>
      </ul>
      <div className="mt-auto pt-10">
        <button
          onClick={onStart}
          className="w-full rounded-2xl bg-white py-4 text-lg font-bold text-orange-600 shadow-lg transition active:scale-[0.98] active:bg-orange-50"
        >
          スタート
        </button>
      </div>
    </main>
  );
}

function Result({
  data,
  answers,
  questions,
  onEdit,
  onRestart,
}: {
  data: PriceData;
  answers: Answers;
  questions: Question[];
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
    <main className="animate-question-in mx-auto flex min-h-dvh w-full max-w-md flex-1 flex-col gap-5 bg-slate-50 px-4 pb-10 pt-6">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-orange-600">シミュレーション結果</p>
        <p className="mt-1 text-sm text-slate-500">
          {license === "AT" ? "AT（オートマ）" : "MT（マニュアル）"}の場合
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-2 ring-orange-600">
        <div className="bg-orange-600 px-5 py-5 text-white">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">当校</span>
            <p className="text-sm font-semibold">{target.school.name}</p>
          </div>
          <p className="mt-2 text-4xl font-bold tracking-tight">
            {target.result.total.toLocaleString("ja-JP")}
            <span className="ml-1 text-lg">円</span>
          </p>
          {isCheapest && maxSaving > 0 && (
            <p className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-sm font-bold text-orange-600">
              近隣校より最大 {formatYen(maxSaving)} お得！
            </p>
          )}
          {isCheapest && maxSaving === 0 && others.length > 0 && (
            <p className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-sm font-bold text-orange-600">近隣校と同額で最安</p>
          )}
        </div>

        <div className="px-5 py-4">
          {discounts.length > 0 && (
            <div className="rounded-2xl bg-orange-50 px-4 py-3">
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
            <summary className="cursor-pointer py-1 text-sm font-medium text-orange-600">料金の内訳を見る</summary>
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
          <h2 className="mb-2 px-1 text-sm font-bold text-slate-700">近隣校との比較（安い順）</h2>
          <ol className="flex flex-col gap-2">
            {rows.map(({ school, result }, i) => {
              const diff = result.total - target.result.total;
              const isTarget = school.id === target.school.id;
              return (
                <li
                  key={school.id}
                  className={`rounded-2xl px-4 py-3 ring-1 ${
                    isTarget ? "bg-orange-50 ring-2 ring-orange-600" : "bg-white ring-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        i === 0 ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {school.name}
                        {isTarget && <span className="ml-1 text-xs text-orange-600">（当校）</span>}
                      </p>
                      {!isTarget && diff !== 0 && (
                        <p className={`text-xs ${diff > 0 ? "text-slate-500" : "text-slate-400"}`}>
                          当校より{formatYen(Math.abs(diff))}{diff > 0 ? "高い" : "安い"}
                        </p>
                      )}
                      {!isTarget && diff === 0 && <p className="text-xs text-slate-400">当校と同額</p>}
                    </div>
                    <p className="whitespace-nowrap text-base font-bold text-slate-900">{formatYen(result.total)}</p>
                  </div>
                  {!isTarget && (
                    <details className="mt-1 pl-10">
                      <summary className="cursor-pointer text-xs text-orange-600">内訳を見る</summary>
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

      <section className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
        <h2 className="text-sm font-bold text-slate-700">回答内容</h2>
        <p className="mt-0.5 text-xs text-slate-400">タップすると回答を変更できます</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {questions.map((q) => (
            <li key={q.key}>
              <button onClick={() => onEdit(q.key)} className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm">
                <span className="text-slate-500">{q.summaryLabel}</span>
                <span className="font-medium text-slate-900">
                  {optionLabel(q, answers[q.key])} <span className="text-orange-600">›</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button
        onClick={onRestart}
        className="w-full rounded-2xl border-2 border-orange-600 bg-white py-3.5 font-bold text-orange-600 transition active:bg-orange-50"
      >
        最初からやり直す
      </button>

      <p className="text-center text-xs text-slate-400">最終更新: {new Date(data.updatedAt).toLocaleString("ja-JP")}</p>
    </main>
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
