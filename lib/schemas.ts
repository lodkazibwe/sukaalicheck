import { z } from "zod";

export const loginSchema = z.object({
  facilityId: z.string().min(1, "Enter your facility ID"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const predictionSchema = z.object({
  // Step 1 — Patient
  age: z
    .number({ error: "Enter a valid age" })
    .int()
    .min(18, "Must be at least 18")
    .max(100, "Must be 100 or under"),
  sex: z.enum(["Male", "Female"] as const, "Select a sex"),

  // Step 2 — Body
  weight: z
    .number({ error: "Enter a valid weight" })
    .min(20, "Min 20 kg")
    .max(300, "Max 300 kg"),
  height: z
    .number({ error: "Enter a valid height" })
    .min(100, "Min 100 cm")
    .max(220, "Max 220 cm"),

  // Step 3 — History
  familyHistoryDiabetes: z.enum(["yes", "no"] as const, "Required"),
  hypertension: z.enum(["yes", "no"] as const, "Required"),

  // Step 4 — Lifestyle
  physicalActivity: z.enum(["low", "moderate", "high"] as const, "Required"),
  dietQuality: z.number().int().min(1).max(10),

  // Step 5 — Blood
  bloodGlucose: z
    .number({ error: "Enter a valid number" })
    .min(0)
    .max(2000)
    .optional(),
});

export type PredictionInput = z.infer<typeof predictionSchema>;
