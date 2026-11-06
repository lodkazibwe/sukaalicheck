// Fasting blood glucose units. Most glucometers in use (e.g. On-Call) read mmol/L;
// the risk model takes mg/dL. The backend does the authoritative conversion — these
// helpers are for validation hints and display only.

export const GLUCOSE_UNITS = ["mmol/L", "mg/dL"] as const;
export type GlucoseUnit = (typeof GLUCOSE_UNITS)[number];

export const DEFAULT_GLUCOSE_UNIT: GlucoseUnit = "mmol/L";

export const MMOL_TO_MG_DL = 18;

// Accepted readings per unit (glucometer display range). Keep in sync with the backend.
export const GLUCOSE_RANGE: Record<GlucoseUnit, { min: number; max: number }> = {
  "mmol/L": { min: 1.1, max: 33.3 },
  "mg/dL": { min: 20, max: 600 },
};

export function otherUnit(unit: GlucoseUnit): GlucoseUnit {
  return unit === "mmol/L" ? "mg/dL" : "mmol/L";
}

export function convertGlucose(value: number, from: GlucoseUnit): number {
  return from === "mmol/L"
    ? Math.round(value * MMOL_TO_MG_DL * 10) / 10
    : Math.round((value / MMOL_TO_MG_DL) * 10) / 10;
}

/** True when the value is out of range for `unit` but valid in the other unit. */
export function looksLikeOtherUnit(value: number, unit: GlucoseUnit): boolean {
  const own = GLUCOSE_RANGE[unit];
  const other = GLUCOSE_RANGE[otherUnit(unit)];
  const inOwn = value >= own.min && value <= own.max;
  const inOther = value >= other.min && value <= other.max;
  return !inOwn && inOther;
}

/** "5.5 mmol/L (99 mg/dL)" — the reading as entered, with the other unit alongside. */
export function formatGlucose(value: number, unit: GlucoseUnit): string {
  return `${value} ${unit} (${convertGlucose(value, unit)} ${otherUnit(unit)})`;
}
