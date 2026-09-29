import { CalendarClock, CalendarDays, ListTodo, TimerOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { type MyTasksScope } from "@/hooks/use-my-tasks-view";
import { cn } from "@/lib/cn";

const SCOPES: Array<{
  key: MyTasksScope;
  labelKey: string;
  icon: typeof ListTodo;
}> = [
  { key: "all", labelKey: "tasks:myTasks.scope.all", icon: ListTodo },
  { key: "overdue", labelKey: "tasks:myTasks.scope.overdue", icon: TimerOff },
  { key: "today", labelKey: "tasks:myTasks.scope.today", icon: CalendarDays },
  {
    key: "upcoming",
    labelKey: "tasks:myTasks.scope.upcoming",
    icon: CalendarClock,
  },
];

export function ScopeSwitcher({
  scope,
  onScopeChange,
}: {
  scope: MyTasksScope;
  onScopeChange: (scope: MyTasksScope) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5">
      {SCOPES.map((item) => (
        <Button
          key={item.key}
          variant={scope === item.key ? "secondary" : "ghost"}
          size="xs"
          onClick={() => onScopeChange(item.key)}
          className={cn(
            "h-6 gap-1.5 rounded-md px-2 text-xs",
            scope !== item.key && "text-muted-foreground",
          )}
        >
          <item.icon className="size-3.5" />
          {t(item.labelKey)}
        </Button>
      ))}
    </div>
  );
}
