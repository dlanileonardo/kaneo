import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { isPast, isToday, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import icons from "@/constants/project-icons";
import { useAgendaTasks } from "@/hooks/queries/task/use-agenda-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import type Task from "@/types/task";

type DashboardSearchParams = {
  taskId?: string;
};

type AgendaEntry = {
  task: Task;
  project: { id: string; name: string; icon: string | null };
  dueDate: Date;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/dashboard",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): DashboardSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function TaskCard({
  task,
  projectName,
  projectIcon,
  onClick,
}: {
  task: Task;
  projectName: string;
  projectIcon: string | null;
  onClick: () => void;
}) {
  const IconComponent =
    icons[projectIcon as keyof typeof icons] ?? icons.Layout;
  const isOverdue = task.dueDate ? isPast(new Date(task.dueDate)) : false;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-border/80 bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
    >
      <IconComponent className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {task.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {projectName}
        </span>
      </span>
      {task.dueDate && (
        <Badge
          variant={isOverdue ? "destructive" : "secondary"}
          className="shrink-0"
        >
          {formatDateShort(task.dueDate)}
        </Badge>
      )}
    </button>
  );
}

function Section({
  title,
  count,
  children,
  accent,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2
          className={cn(
            "text-sm font-semibold uppercase tracking-wide",
            accent ? "text-primary" : "text-muted-foreground",
          )}
        >
          {title}
        </h2>
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-sm px-1 text-[11px] font-medium",
            accent
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function TaskListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border/80 bg-card px-3 py-2.5"
        >
          <Skeleton className="size-4" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border/80 px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { tasks, isLoading } = useAgendaTasks({ workspaceId });
  const [selected, setSelected] = useState<{
    taskId: string;
    projectId: string;
  } | null>(null);

  const now = startOfDay(new Date());

  const { today, upcoming } = useMemo(() => {
    const todayEntries: AgendaEntry[] = [];
    const upcomingEntries: AgendaEntry[] = [];

    for (const entry of tasks) {
      if (!entry.task.dueDate) continue;
      const due = new Date(entry.task.dueDate);
      if (!Number.isNaN(due.getTime())) {
        if (isToday(due) || isPast(due)) {
          todayEntries.push({ ...entry, dueDate: due });
        } else if (due > now) {
          upcomingEntries.push({ ...entry, dueDate: due });
        }
      }
    }

    const byDate = (a: AgendaEntry, b: AgendaEntry) =>
      a.dueDate.getTime() - b.dueDate.getTime();

    return {
      today: todayEntries.sort(byDate),
      upcoming: upcomingEntries.sort(byDate),
    };
  }, [tasks, now]);

  const handleOpenTask = (taskId: string, projectId: string) => {
    if (isMobile) {
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
        params: { workspaceId, projectId, taskId },
      });
      return;
    }
    setSelected({ taskId, projectId });
    navigate({ to: ".", search: { taskId }, replace: true });
  };

  const handleClose = () => {
    setSelected(null);
    navigate({ to: ".", search: {}, replace: true });
  };

  const activeProjectId =
    selected?.projectId ??
    tasks.find((entry) => entry.task.id === taskId)?.project.id;

  return (
    <>
      <PageTitle title={t("navigation:sidebar.dashboard")} />
      <WorkspaceLayout title={t("navigation:sidebar.dashboard")}>
        <div
          className={cn(
            "mx-auto grid w-full max-w-5xl gap-6 p-4",
            !isMobile && "grid-cols-2",
          )}
        >
          <Section
            title={t("tasks:dashboard.today")}
            count={today.length}
            accent
          >
            {isLoading ? (
              <TaskListSkeleton />
            ) : today.length === 0 ? (
              <EmptyText>{t("tasks:dashboard.noToday")}</EmptyText>
            ) : (
              <div className="flex flex-col gap-2">
                {today.map((entry) => (
                  <TaskCard
                    key={entry.task.id}
                    task={entry.task}
                    projectName={entry.project.name}
                    projectIcon={entry.project.icon}
                    onClick={() =>
                      handleOpenTask(entry.task.id, entry.project.id)
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title={t("tasks:dashboard.upcoming")} count={upcoming.length}>
            {isLoading ? (
              <TaskListSkeleton />
            ) : upcoming.length === 0 ? (
              <EmptyText>{t("tasks:dashboard.noUpcoming")}</EmptyText>
            ) : (
              <div className="flex flex-col gap-2">
                {upcoming.map((entry) => (
                  <TaskCard
                    key={entry.task.id}
                    task={entry.task}
                    projectName={entry.project.name}
                    projectIcon={entry.project.icon}
                    onClick={() =>
                      handleOpenTask(entry.task.id, entry.project.id)
                    }
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      </WorkspaceLayout>

      {activeProjectId && (
        <TaskDetailsSheet
          taskId={taskId}
          projectId={activeProjectId}
          workspaceId={workspaceId}
          onClose={handleClose}
        />
      )}
    </>
  );
}