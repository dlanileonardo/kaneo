import { useQueries } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";
import getProjects from "@/fetchers/project/get-projects";
import type { ProjectWithTasks } from "@/types/project";

type AgendaTask = {
  task: NonNullable<ProjectWithTasks["columns"][number]["tasks"]>[number];
  project: {
    id: string;
    name: string;
    icon: string | null;
  };
};

/**
 * Aggregates every task across all projects in a workspace so the agenda
 * dashboard can render a cross-project Today / Upcoming view.
 */
export function useAgendaTasks({ workspaceId }: { workspaceId: string }) {
  const projectResults = useQueries({
    queries: [
      {
        queryKey: ["agenda-projects", workspaceId],
        queryFn: () => getProjects({ workspaceId }),
        enabled: !!workspaceId,
      },
    ],
  });

  const projects = projectResults[0]?.data ?? [];

  const taskResults = useQueries({
    queries: projects.map((project) => ({
      queryKey: ["tasks", project.id],
      queryFn: ({ signal }) => getTasks(project.id, signal),
      enabled: !!project.id,
    })),
  });

  const isLoading =
    projectResults[0]?.isLoading ||
    taskResults.some((result) => result.isLoading);

  const tasks: AgendaTask[] = [];

  projects.forEach((project, index) => {
    const board = taskResults[index]?.data;
    if (!board) return;

    const allTasks = [
      ...board.columns.flatMap((column) => column.tasks),
      ...board.plannedTasks,
      ...board.archivedTasks,
    ];

    for (const task of allTasks) {
      tasks.push({
        task,
        project: { id: project.id, name: project.name, icon: project.icon },
      });
    }
  });

  return { tasks, isLoading };
}