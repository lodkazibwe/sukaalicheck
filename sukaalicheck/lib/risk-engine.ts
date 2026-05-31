import type { PredictionInput } from "@/lib/schemas";
import type { RiskLevel, PredictionRecord } from "@/lib/mock";

export function bmi(weight: number, height: number): number {
  return weight / Math.pow(height / 100, 2);
}

export function bmiCategory(b: number): string {
  if (b < 18.5) return "Underweight";
  if (b < 25) return "Normal";
  if (b < 30) return "Overweight";
  return "Obese";
}

function scoreInput(data: PredictionInput): {
  score: number;
  factors: string[];
} {
  let score = 0;
  const factors: string[] = [];

  // Age
  if (data.age >= 55) { score += 15; factors.push("Age over 55"); }
  else if (data.age >= 45) { score += 8; }

  // BMI
  const b = bmi(data.weight, data.height);
  if (b >= 30) { score += 15; factors.push("BMI in obese range"); }
  else if (b >= 25) { score += 8; factors.push("BMI elevated"); }

  // Family history
  if (data.familyHistoryDiabetes === "yes") {
    score += 15;
    factors.push("Family history of diabetes");
  }

  // Hypertension
  if (data.hypertension === "yes") {
    score += 10;
    factors.push("History of hypertension");
  }

  // Physical activity
  if (data.physicalActivity === "low") {
    score += 10;
    factors.push("Low physical activity");
  } else if (data.physicalActivity === "intermediate") {
    score += 3;
  }

  // Diet quality (1–10; low diet = risk factor)
  if (data.dietQuality <= 3) { score += 8; factors.push("Poor diet quality"); }
  else if (data.dietQuality >= 8) { score = Math.max(0, score - 5); }

  // Blood glucose
  if (data.bloodGlucose !== undefined) {
    if (data.bloodGlucose >= 126) {
      score += 20;
      factors.push("Blood glucose in diabetes range");
    } else if (data.bloodGlucose >= 100) {
      score += 10;
      factors.push("Blood glucose in prediabetes range");
    }
  }

  return { score: Math.max(0, Math.min(score, 100)), factors };
}

function levelFromScore(score: number): RiskLevel {
  if (score >= 60) return "high";
  if (score >= 35) return "intermediate";
  return "low";
}

export function computeRisk(
  data: PredictionInput
): Omit<PredictionRecord, "staffId"> {
  const { score, factors } = scoreInput(data);
  const level = levelFromScore(score);
  const ts = Date.now();
  const id = `pred-${ts}`;
  const num = String(ts).slice(-4);

  return {
    id,
    patientName: `Patient #p_${num}`,
    age: data.age,
    sex: data.sex,
    riskLevel: level,
    riskScore: score,
    createdAt: new Date().toISOString(),
    keyFactors: factors,
  };
}
