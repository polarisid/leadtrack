import { Badge } from "@/components/ui/badge";
import { ClientStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: ClientStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusColors: Record<ClientStatus, string> = {
    "Novo Lead": "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-800",
    "Em negociação": "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800",
    "Fechado": "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800",
    "Pós-venda": "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-800",
  };

  return (
    <Badge variant="outline" className={cn("font-normal", statusColors[status], className)}>
      {status}
    </Badge>
  );
}
