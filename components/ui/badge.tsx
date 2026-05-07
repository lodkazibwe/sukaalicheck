import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        success: "bg-primary/10 text-primary",
        warning: "bg-amber-100 text-amber-700",
        destructive: "bg-danger-50 text-danger",
        outline: "border border-border text-foreground",
        "risk-low": "bg-risk-low/10 text-risk-low",
        "risk-moderate": "bg-risk-moderate/10 text-risk-moderate",
        "risk-high": "bg-risk-high/10 text-risk-high",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
