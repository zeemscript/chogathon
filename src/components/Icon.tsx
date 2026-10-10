import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import { cn } from "@/lib/utils";

// One place for icon defaults so every Hugeicon in the app looks the same.
export default function Icon({ className, size = 16, strokeWidth = 2, ...props }: HugeiconsIconProps) {
  return <HugeiconsIcon size={size} strokeWidth={strokeWidth} className={cn("shrink-0", className)} {...props} />;
}
