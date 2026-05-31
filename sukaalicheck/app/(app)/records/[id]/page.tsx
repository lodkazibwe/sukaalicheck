import { MOCK_RECORDS } from "@/lib/mock";

export function generateStaticParams() {
  return MOCK_RECORDS.map((r) => ({ id: r.id }));
}

export default function RecordDetailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Record detail — coming soon.</p>
    </div>
  );
}
