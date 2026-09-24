import { useNavigate } from "@tanstack/react-router";
import { isPast, isToday, startOfDay } from "date-fns";
import { useCallback, useMemo } from "react";
import {
  type TaskViewContextValue,
  toProjectRef,
} from "@/components/task/task-view-context";
import { useAgendaTasks } from "@/hooks/queries/task/use-agenda-tasks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

/** Id of the synthetic agenda board; never a real project id. */
export const AGENDA_BOARD_ID = "agenda";

export type AgendaScope = "today" | "upcoming";

type AgendaProject = {
  id: string;
  name: string;
  icon: string | null;
  workspaceId: string;
  columns: Array<{
    slug: string;
    name: string;
    icon: string | null;
    isFinal: boolean;
  }>;
};

type MergedColumn = ProjectWithTasks["columns"][number] & {
  minPosition: number;
};

export function buildAgendaBoard(
  entries: Array<{
    task: Task;
    project: { id: string; name: string; icon: string | null };
  }>,
  scope: AgendaScope,
  projects: AgendaProject[],
): ProjectWithTasks | null {
  const now = startOfDay(new Date());
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const columnsBySlug = new Map<string, MergedColumn>();

  for (const project of projects) {
    for (const column of project.columns) {
      const merged = columnsBySlug.get(column.slug);
      if (!merged) {
        columnsBySlug.set(column.slug, {
          id: column.slug,
          slug: column.slug,
          name: column.name,
          icon: column.icon,
          isFinal: column.isFinal,
          tasks: [],
          minPosition: 0,
        });
        continue;
      }
      merged.isFinal = merged.isFinal || column.isFinal;
      merged.icon = merged.icon ?? column.icon;
    }
  }

  for (const entry of entries) {
    const { task } = entry;
    if (!task.dueDate) continue;

    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) continue;

    const inScope = scope === "today" ? isToday(due) || isPast(due) : due > now;

    if (!inScope) continue;
    if (!projectById.has(task.projectId)) continue;

    const column = columnsBySlug.get(task.status);
    if (!column) continue;

    column.tasks.push(task);
  }

  const columns = [...columnsBySlug.values()]
    .sort(
      (a, b) => a.minPosition - b.minPosition || a.slug.localeCompare(b.slug),
    )
    .map(({ minPosition: _position, ...column }) => column);

  return {
    id: AGENDA_BOARD_ID,
    name: "",
    slug: "",
    icon: null,
    description: null,
    isPublic: false,
    workspaceId: "",
    columns,
    archivedTasks: [],
    plannedTasks: [],
  };
}

/**
 * Everything the workspace agenda dashboard needs: the aggregated tasks from
 * every project folded into a board per scope, the per-task project lookup,
 * and the details-sheet wiring — mirroring useMyTasksView.
 */
export function useAgendaView({
  workspaceId,
  scope,
  taskId,
}: {
  workspaceId: string;
  scope: AgendaScope;
  taskId?: string;
}) {
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const { tasks, projects, isLoading } = useAgendaTasks({ workspaceId });
  const workspaceName = workspace?.name ?? "";

  const board = useMemo(
    () => buildAgendaBoard(tasks, scope, projects),
    [tasks, scope, projects],
  );

  const getProjectSlug = useCallback(
    (task: Task) =>
      projects.find((project) => project.id === task.projectId)?.slug,
    [projects],
  );

  const taskView = useMemo<TaskViewContextValue>(
    () => ({
      getTaskProject: (task) =>
        toProjectRef(projects.find((project) => project.id === task.projectId)),
      getTaskProjectById: (id) =>
        toProjectRef(
          projects.find((project) =>
            tasks.some(
              (entry) =>
                entry.task.id === id && entry.project.id === project.id,
            ),
          ),
        ),
      capabilities: {
        bulkSelection: false,
        columnActions: false,
        manualSort: false,
      },
    }),
    [projects, tasks],
  );

  const labels = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const entry of tasks) {
      for (const label of entry.task.labels ?? []) {
        if (!seen.has(label.id)) seen.set(label.id, label);
      }
    }
    return [...seen.values()];
  }, [tasks]);

  const sheetProject = useMemo(() => {
    if (!taskId) return undefined;
    return projects.find((project) =>
      tasks.some(
        (entry) => entry.task.id === taskId && entry.project.id === project.id,
      ),
    );
  }, [tasks, projects, taskId]);

  const openTask = useCallback(
    (nextTaskId: string) => {
      navigate({ to: ".", search: { taskId: nextTaskId }, replace: true });
    },
    [navigate],
  );

  const closeTask = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  return {
    board,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      workspaceName,
    })),
    labels,
    taskView,
    getProjectSlug,
    isLoading,
    sheet: {
      taskId: sheetProject ? taskId : undefined,
      projectId: sheetProject?.id,
      workspaceId: sheetProject?.workspaceId,
      onClose: closeTask,
    },
    openTask,
  };
}
