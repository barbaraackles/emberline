import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Rating } from "@/lib/catalog";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-2xs font-medium tracking-wide text-muted shadow-border",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RatingBadge({ rating }: { rating: Rating }) {
  const label =
    rating === "very-high"
      ? "Very high"
      : rating === "watch"
        ? "Watch"
        : rating[0].toUpperCase() + rating.slice(1);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-2xs font-medium tracking-wide",
        rating === "extreme" && "bg-ember text-fg",
        rating === "very-high" && "bg-ember-soft text-fg",
        rating === "high" && "bg-raised text-fg shadow-border",
        rating === "moderate" && "bg-raised text-muted shadow-border",
        rating === "watch" && "bg-transparent text-subtle shadow-border",
      )}
    >
      {label}
    </span>
  );
}
