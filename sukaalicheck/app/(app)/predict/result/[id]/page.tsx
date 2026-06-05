import { ResultClient } from "./result-client";

export function generateStaticParams() {
  return [{ id: "_" }];
}

export default async function ResultPage() {
  return <ResultClient />;
}
