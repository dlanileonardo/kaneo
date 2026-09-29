import { useNavigate } from "@tanstack/react-router";
import { endOfDay, isToday, startOfDay } from "date-fns";
import { useCallback, useEffect, useMemo } from "react";
import {
  type TaskViewContextValue,
  toProjectRef,
} from "@/components/task/task-view-context";
import { shortcuts } from "@/constants/shortcuts";
import { useGetAssignedTasks } from "@/hooks/queries/task/use-get-assigned-tasks";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { buildAssignedBoard } from "@/lib/assigned-board";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

/** Scope of the "My tasks" view: all, or a due-date bucket. */
export type MyTasksScope = "all" | "overdue" | "today" | "upcoming";

/** Tasks whose due date falls in the given bucket. */
export function filterTasksByScope(tasks: Task[], scope: MyTasksScope): Task[] {
  if (scope === "all") return tasks;
  const today = startOfDay(new Date());
  const endOfToday = endOfDay(new Date());
  return tasks.filter((task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    if (scope === "overdue") return due < today;
    if (scope === "today") return isToday(due);
    return due > endOfToday;
  });
}

/**
 * Everything the "My tasks" routes share: the assigned-tasks query folded into
 * a board, the per-task project lookup the task components read, the selected
 * task for the details sheet, and the view shortcuts.
 *
 * When `workspaceId` is given, only tasks in that workspace are fetched; the
 * "My tasks" view otherwise spans every workspace the user is a member of.
 */
export function useMyTasksView(
  taskId: string | undefined,
  workspaceId?: string,
  scope: MyTasksScope = "all",
) {
  const navigate = useNavigate();
  const setProject = useProjectStore((state) => state.setProject);
  const setViewMode = useUserPreferencesStore((state) => state.setViewMode);
  const { data, isLoading, isError } = useGetAssignedTasks(workspaceId);

  // Cards fall back to the project in the store when no per-task lookup is
  // available; a stale project from the last board must not be that fallback.
  useEffect(() => {
    setProject(undefined);
  }, [setProject]);

  const assigned = useMemo(() => {
    if (!data) return null;
    const scoped = filterTasksByScope(data.tasks, scope);
    return buildAssignedBoard({ tasks: scoped, projects: data.projects });
  }, [data, scope]);

  const getProjectSlug = useCallback(
    (task: Task) => assigned?.projectById.get(task.projectId)?.slug,
    [assigned],
  );

  const taskView = useMemo<TaskViewContextValue>(
    () => ({
      getTaskProject: (task) =>
        toProjectRef(assigned?.projectById.get(task.projectId)),
      getTaskProjectById: (id) => {
        const projectId = assigned?.projectIdByTaskId.get(id);
        return projectId
          ? toProjectRef(assigned?.projectById.get(projectId))
          : undefined;
      },
      // Positions are per project and bulk operations are per workspace, so
      // none of these can be offered on a board that merges several of each.
      capabilities: {
        bulkSelection: false,
        columnActions: false,
        manualSort: false,
      },
    }),
    [assigned],
  );

  // The filter menu groups projects under their workspace, so they must
  // arrive grouped; the API orders by project position only.
  const projects = useMemo(
    () =>
      (data?.projects ?? [])
        .map((project) => ({
          id: project.id,
          name: project.name,
          workspaceName: project.workspaceName,
        }))
        .sort(
          (left, right) =>
            left.workspaceName.localeCompare(right.workspaceName) ||
            left.name.localeCompare(right.name),
        ),
    [data],
  );

  // Labels are workspace-scoped; the union found on the tasks is the only set
  // that spans every workspace shown.
  const labels = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const task of data?.tasks ?? []) {
      for (const label of task.labels ?? []) {
        if (!seen.has(label.id)) seen.set(label.id, label);
      }
    }
    return [...seen.values()];
  }, [data]);

  const sheetProject = taskId
    ? assigned?.projectById.get(assigned.projectIdByTaskId.get(taskId) ?? "")
    : undefined;

  const openTask = useCallback(
    (nextTaskId: string) => {
      navigate({ to: ".", search: { taskId: nextTaskId }, replace: true });
    },
    [navigate],
  );

  const closeTask = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.view.prefix]: {
        [shortcuts.view.board]: () => {
          setViewMode("board");
          navigate({ to: "/dashboard/my-tasks/board" });
        },
        [shortcuts.view.list]: () => {
          setViewMode("list");
          navigate({ to: "/dashboard/my-tasks/board" });
        },
        [shortcuts.view.calendar]: () =>
          navigate({ to: "/dashboard/my-tasks/calendar" }),
      },
    },
  });

  return {
    board: assigned?.board ?? null,
    projectById: assigned?.projectById,
    tasks: data?.tasks ?? [],
    projects,
    labels,
    taskView,
    getProjectSlug,
    isLoading,
    isError,
    sheet: {
      taskId: sheetProject ? taskId : undefined,
      projectId: sheetProject?.id,
      workspaceId: sheetProject?.workspaceId,
      onClose: closeTask,
    },
    openTask,
  };
}
