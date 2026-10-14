import { Loading03Icon } from "@hugeicons/core-free-icons";
import Icon from "@/components/Icon";
import { cn } from "@/lib/utils";

// Spinning loader for buttons that are waiting on the server or the wallet.
export default function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <Icon icon={Loading03Icon} size={size} className={cn("animate-spin", className)} aria-hidden />;
}
