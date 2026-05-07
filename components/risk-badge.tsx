import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/lib/mock";

interface RiskBadgeProps {
  level: RiskLevel;
  size?: "sm" | "default";
}

const labels: Record<RiskLevel, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
};

const variants: Record<
  RiskLevel,
  "risk-low" | "risk-moderate" | "risk-high"
> = {
  low: "risk-low",
  moderate: "risk-moderate",
  high: "risk-high",
};

export function RiskBadge({ level, size = "default" }: RiskBadgeProps) {
  return (
    <Badge
      variant={variants[level]}
      className={size === "sm" ? "text-[11px] px-2 py-0.5" : ""}
    >
      {labels[level]}
    </Badge>
  );
}
