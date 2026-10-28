import type { Metadata } from "next";
import { getData } from "@/lib/store";
import MobileSimulator from "@/components/MobileSimulator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KDS熊本ドライビングスクール 料金シミュレーター（スマホ版）",
};

const ANONYMOUS_LABELS = ["A", "B", "C", "D", "E"];

// 生徒用ページ（/student）と同じデータ・同じ匿名化ルールを使う。管理画面の変更はこちらにもそのまま反映される。
export default async function MobilePage() {
  const data = await getData();

  let counter = 0;
  const schools = data.schools.map((school) =>
    school.hideName
      ? { ...school, name: `近隣${ANONYMOUS_LABELS[counter++] ?? counter}校` }
      : school
  );

  return <MobileSimulator data={{ ...data, schools }} />;
}
