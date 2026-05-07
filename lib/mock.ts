export type RiskLevel = "low" | "moderate" | "high";

export interface Staff {
  id: string;
  name: string;
  facilityId: string;
  facility: string;
  subscriptionStatus: "active" | "expiring" | "expired";
  subscriptionExpiry: string;
  plan: string;
}

export interface PredictionRecord {
  id: string;
  patientName: string;
  age: number;
  sex: "Male" | "Female";
  riskLevel: RiskLevel;
  riskScore: number;
  createdAt: string;
  staffId: string;
  keyFactors?: string[];
}

export const MOCK_STAFF: Staff = {
  id: "staff-001",
  name: "James Mwesigye",
  facilityId: "KLA-0421",
  facility: "Mulago Herbal Clinic",
  subscriptionStatus: "active",
  subscriptionExpiry: "2026-05-30",
  plan: "Standard plan",
};

export const MOCK_RECORDS: PredictionRecord[] = [
  {
    id: "rec-001",
    patientName: "Nakato Sarah",
    age: 54,
    sex: "Female",
    riskLevel: "high",
    riskScore: 78,
    createdAt: "2026-05-07T11:42:00Z",
    staffId: "staff-001",
    keyFactors: ["Family history", "Age over 45", "Physical inactivity"],
  },
  {
    id: "rec-002",
    patientName: "Okello Joseph",
    age: 38,
    sex: "Male",
    riskLevel: "low",
    riskScore: 22,
    createdAt: "2026-05-07T10:08:00Z",
    staffId: "staff-001",
    keyFactors: [],
  },
  {
    id: "rec-003",
    patientName: "Namuli Beatrice",
    age: 47,
    sex: "Female",
    riskLevel: "moderate",
    riskScore: 48,
    createdAt: "2026-05-07T09:15:00Z",
    staffId: "staff-001",
    keyFactors: ["BMI elevated", "Sedentary lifestyle"],
  },
  {
    id: "rec-004",
    patientName: "Mukasa Ronald",
    age: 61,
    sex: "Male",
    riskLevel: "high",
    riskScore: 82,
    createdAt: "2026-05-06T16:30:00Z",
    staffId: "staff-001",
    keyFactors: ["Age over 55", "Family history", "Frequent urination"],
  },
  {
    id: "rec-005",
    patientName: "Apio Christine",
    age: 29,
    sex: "Female",
    riskLevel: "low",
    riskScore: 18,
    createdAt: "2026-05-06T14:02:00Z",
    staffId: "staff-001",
    keyFactors: [],
  },
  {
    id: "rec-006",
    patientName: "Ssali Ibrahim",
    age: 52,
    sex: "Male",
    riskLevel: "moderate",
    riskScore: 55,
    createdAt: "2026-05-06T11:21:00Z",
    staffId: "staff-001",
    keyFactors: ["BMI elevated", "History of hypertension"],
  },
  {
    id: "rec-007",
    patientName: "Auma Grace",
    age: 44,
    sex: "Female",
    riskLevel: "low",
    riskScore: 28,
    createdAt: "2026-05-05T15:44:00Z",
    staffId: "staff-001",
    keyFactors: [],
  },
];

export function daysUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function todayRecords(records: PredictionRecord[]): PredictionRecord[] {
  const today = new Date().toISOString().split("T")[0];
  return records.filter((r) => r.createdAt.startsWith(today));
}

export function thisWeekRecords(
  records: PredictionRecord[]
): PredictionRecord[] {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return records.filter((r) => new Date(r.createdAt) >= weekAgo);
}
