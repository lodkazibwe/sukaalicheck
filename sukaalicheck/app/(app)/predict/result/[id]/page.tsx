import { MOCK_RECORDS } from "@/lib/mock";
import { ResultClient } from "./result-client";

export function generateStaticParams() {
  return MOCK_RECORDS.map((r) => ({ id: r.id }));
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultClient id={id} />;
}
