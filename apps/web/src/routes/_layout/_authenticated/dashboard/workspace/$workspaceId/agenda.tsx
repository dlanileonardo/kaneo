import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, Search, Sun } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BoardToolbar from "@/components/board/board-toolbar";
import WorkspaceLayout from "@/components/common/workspace-layout";
import KanbanBoard from "@/components/kanban-board";
import ListView from "@/components/list-view";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { TaskViewProvider } from "@/components/task/task-view-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AGENDA_BOARD_ID,
  type AgendaScope,
  useAgendaView,
} from "@/hooks/use-agenda-view";
import { useBoardSort } from "@/hooks/use-board-sort";
import { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";
import { WorkspacePermissionScope } from "@/hooks/use-workspace-permission";
import { type SortConfig, sortTasks } from "@/lib/sort-tasks";
import { cn } from "@/lib/utils";
import { useUserPreferencesStore } from "@/store/user-preferences";

type AgendaSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agenda",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): AgendaSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

const DEFAULT_SORT: SortConfig = { field: "dueDate", direction: "asc" };

function ScopeSwitcher({
  scope,
  onScopeChange,
}: {
  scope: AgendaScope;
  onScopeChange: (scope: AgendaScope) => void;
}) {
  const { t } = useTranslation();

  const scopes: Array<{
    key: AgendaScope;
    label: string;
    icon: typeof Sun;
  }> = [
    {
      key: "today",
      label: t("tasks:agenda.today"),
      icon: Sun,
    },
    {
      key: "upcoming",
      label: t("tasks:agenda.upcoming"),
      icon: CalendarClock,
    },
  ];

  return (
    <div className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5">
      {scopes.map((item) => (
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
          {item.label}
        </Button>
      ))}
    </div>
  );
}

function StatusMessage({
  title,
  subtitle,
  muted = false,
}: {
  title: string;
  subtitle?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p
          className={
            muted
              ? "text-sm text-muted-foreground"
              : "text-sm font-semibold text-foreground"
          }
        >
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const { viewMode, setViewMode } = useUserPreferencesStore();
  const [scope, setScope] = useState<AgendaScope>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const { sort, setSort } = useBoardSort(AGENDA_BOARD_ID, DEFAULT_SORT);
  const {
    board,
    projects,
    labels,
    taskView,
    getProjectSlug,
    isLoading,
    sheet,
  } = useAgendaView({ workspaceId, scope, taskId });

  const {
    filters,
    updateFilter,
    updateLabelFilter,
    updateCustomFieldFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  } = useTaskFiltersWithLabelsSupport(
    board,
    AGENDA_BOARD_ID,
    searchQuery,
    getProjectSlug,
  );

  const sortedBoard = useMemo(() => {
    if (!filteredProject || sort.field === "position") return filteredProject;
    return {
      ...filteredProject,
      columns: filteredProject.columns.map((column) => ({
        ...column,
        tasks: sortTasks(column.tasks, sort),
      })),
    };
  }, [filteredProject, sort]);

  const hasNoTasks =
    board?.columns.every((column) => column.tasks.length === 0) ?? false;
  const hasNoMatches =
    !hasNoTasks &&
    (sortedBoard?.columns.every((column) => column.tasks.length === 0) ??
      false);

  return (
    <>
      <PageTitle title={t("navigation:sidebar.agenda")} hideAppName />
      <WorkspaceLayout
        title={t("navigation:sidebar.agenda")}
        headerActions={
          <div className="flex items-center gap-2">
            <div className="relative w-[180px]">
              <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("tasks:boardSearchPlaceholder")}
                className="h-7.5 [&_[data-slot=input]]:h-7 [&_[data-slot=input]]:leading-7 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs [&_[data-slot=input]]:placeholder:text-xs [&_[data-slot=input]]:placeholder:leading-7"
              />
            </div>
            <ScopeSwitcher scope={scope} onScopeChange={setScope} />
          </div>
        }
      >
        <TaskViewProvider value={taskView}>
          <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
            <BoardToolbar
              project={board}
              projects={projects}
              showAssigneeFilter={false}
              filters={filters}
              updateFilter={updateFilter}
              updateLabelFilter={updateLabelFilter}
              updateCustomFieldFilter={updateCustomFieldFilter}
              clearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              workspaceLabels={labels}
              viewMode={viewMode}
              setViewMode={setViewMode}
              sort={sort}
              onSortChange={setSort}
            />

            <div className="flex h-full flex-1 overflow-hidden bg-background">
              {isLoading || !sortedBoard ? (
                <StatusMessage title={t("common:empty.loading")} muted />
              ) : hasNoTasks ? (
                <StatusMessage
                  title={
                    scope === "today"
                      ? t("tasks:agenda.noToday")
                      : t("tasks:agenda.noUpcoming")
                  }
                />
              ) : hasNoMatches ? (
                <StatusMessage title={t("tasks:myTasks.noMatches")} />
              ) : viewMode === "board" ? (
                <KanbanBoard project={sortedBoard} disableDragDrop />
              ) : (
                <ListView project={sortedBoard} disableDragDrop />
              )}
            </div>

            <WorkspacePermissionScope value={sheet.workspaceId}>
              <TaskDetailsSheet
                taskId={sheet.taskId}
                projectId={sheet.projectId ?? ""}
                workspaceId={sheet.workspaceId ?? ""}
                onClose={sheet.onClose}
              />
            </WorkspacePermissionScope>
          </div>
        </TaskViewProvider>
      </WorkspaceLayout>
    </>
  );
}
