import { z } from "zod";

export const loginSchema = z.object({
  facilityId: z.string().min(1, "Enter your facility ID"),
  password: z.string().min(1, "Enter your password or activation code"),
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
    .positive("Enter a valid weight")
    .max(300, "Max 300 kg"),
  height: z
    .number({ error: "Enter a valid height" })
    .positive("Enter a valid height")
    .max(220, "Max 220 cm"),
  waistCircumference: z
    .number({ error: "Enter a valid number" })
    .positive("Enter a valid number")
    .max(300, "Max 300 cm")
    .optional(),

  // Step 3 — History
  familyHistoryDiabetes: z.enum(["yes", "no"] as const, "Required"),
  hypertension: z.enum(["yes", "no"] as const, "Required"),
  cardiovascularDisease: z.enum(["yes", "no"] as const).optional(),
  pcos: z.enum(["yes", "no"] as const).optional(),
  gestationalDiabetes: z.enum(["yes", "no"] as const).optional(),

  // Step 4 — Lifestyle
  physicalActivity: z.enum(["low", "intermediate", "high"] as const, "Required"),
  dietQuality: z.number().int().min(1).max(10),
  smoking: z.enum(["yes", "no"] as const).optional(),

  // Step 5 — Blood
  bloodGlucose: z
    .number({ error: "Enter a valid number" })
    .min(0)
    .max(2000)
    .optional(),
});

export type PredictionInput = z.infer<typeof predictionSchema>;

// ── Signup ────────────────────────────────────────────────────────────────────

export const FACILITY_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "health_centre", label: "Health centre" },
  { value: "herbal", label: "Herbal facility" },
  { value: "pharmacy", label: "Pharmacy" },
] as const;

export const OWNERSHIPS = [
  { value: "private", label: "Private" },
  { value: "government", label: "Government" },
  { value: "ngo", label: "NGO" },
  { value: "faith_based", label: "Faith-based" },
] as const;

export const DISTRICTS = [
  "Kampala",
  "Wakiso",
  "Mukono",
  "Mpigi",
  "Masaka",
  "Luweero",
  "Butambala",
  "Other",
] as const;

export const SPECIALIST_TITLES = [
  { value: "medical_officer", label: "Medical officer (MBChB)" },
  { value: "clinical_officer", label: "Clinical officer" },
  { value: "nurse", label: "Registered nurse" },
  { value: "midwife", label: "Midwife" },
  { value: "herbalist", label: "Herbal practitioner" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "other", label: "Other" },
] as const;

export const PLANS = [
  {
    value: "monthly" as const,
    label: "Monthly",
    description: "Full access for 30 days",
    amount: 70_000,
    period: "/ month",
  },
  {
    value: "annual" as const,
    label: "Annual",
    description: "Best value · Full access for 12 months",
    amount: 750_000,
    period: "/ year",
  },
  {
    value: "camp_week" as const,
    label: "Camp week",
    description: "5 consecutive days — ideal for outreach camps",
    amount: 100_000,
    period: "/ 5 days",
  },
] as const;

const phoneRegex = /^\+?\d[\d\s-]{7,18}$/;

export const signupSchema = z.object({
  // Step 1 — Facility
  facilityName: z.string().min(2, "Enter your facility name"),
  facilityType: z.enum(
    ["hospital", "clinic", "health_centre", "herbal", "pharmacy"] as const,
    "Select a type",
  ),
  ownership: z.enum(
    ["private", "government", "ngo", "faith_based"] as const,
    "Select ownership",
  ),
  district: z.string().min(1, "Select a district"),
  physicalAddress: z.string().min(2, "Enter a physical address"),
  facilityPhone: z.string().regex(phoneRegex, "Enter a valid phone number"),
  facilityEmail: z.email("Enter a valid email"),

  // Step 2 — Specialist
  specialistName: z.string().min(2, "Enter the specialist's full name"),
  specialistTitle: z.enum(
    [
      "medical_officer",
      "clinical_officer",
      "nurse",
      "midwife",
      "herbalist",
      "pharmacist",
      "other",
    ] as const,
    "Select a title",
  ),
  licenceNumber: z.string().min(2, "Enter the licence number"),
  specialistPhone: z.string().regex(phoneRegex, "Enter a valid phone number"),
});

export type SignupInput = z.infer<typeof signupSchema>;

// ── Payment ───────────────────────────────────────────────────────────────────

export const paymentSchema = z
  .object({
    plan: z.enum(["monthly", "annual", "camp_week"] as const, "Select a plan"),
    campStartDate: z.string().optional(),
    momoNumber: z.string().regex(phoneRegex, "Enter a valid MoMo number"),
  })
  .superRefine((data, ctx) => {
    if (data.plan === "camp_week") {
      if (!data.campStartDate) {
        ctx.addIssue({
          code: "custom",
          message: "Select a start date for the camp week",
          path: ["campStartDate"],
        });
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(data.campStartDate) < today) {
          ctx.addIssue({
            code: "custom",
            message: "Camp start date must be today or in the future",
            path: ["campStartDate"],
          });
        }
      }
    }
  });

export type PaymentInput = z.infer<typeof paymentSchema>;

// ── Change password ───────────────────────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
