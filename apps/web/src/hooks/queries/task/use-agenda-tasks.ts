import { useQueries } from "@tanstack/react-query";
import getProjects from "@/fetchers/project/get-projects";
import getTasks from "@/fetchers/task/get-tasks";
import type { ProjectWithTasks } from "@/types/project";

type AgendaTask = {
  task: NonNullable<ProjectWithTasks["columns"][number]["tasks"]>[number];
  project: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    workspaceId: string;
    columns: Array<{
      slug: string;
      name: string;
      icon: string | null;
      isFinal: boolean;
    }>;
  };
};

type AgendaProject = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  workspaceId: string;
  columns: Array<{
    slug: string;
    name: string;
    icon: string | null;
    isFinal: boolean;
  }>;
};

/**
 * Aggregates every task across all projects in a workspace so the agenda
 * dashboard can render cross-project Today / Upcoming boards.
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
  const agendaProjects: AgendaProject[] = [];

  projects.forEach((project, index) => {
    const board = taskResults[index]?.data;
    if (!board) return;

    agendaProjects.push({
      id: project.id,
      name: project.name,
      slug: project.slug,
      icon: project.icon,
      workspaceId: project.workspaceId,
      columns: board.columns.map((column) => ({
        slug: column.slug,
        name: column.name,
        icon: column.icon,
        isFinal: column.isFinal,
      })),
    });

    const allTasks = [
      ...board.columns.flatMap((column) => column.tasks),
      ...board.plannedTasks,
      ...board.archivedTasks,
    ];

    for (const task of allTasks) {
      tasks.push({
        task,
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          icon: project.icon,
          workspaceId: project.workspaceId,
          columns: board.columns.map((column) => ({
            slug: column.slug,
            name: column.name,
            icon: column.icon,
            isFinal: column.isFinal,
          })),
        },
      });
    }
  });

  return { tasks, projects: agendaProjects, isLoading };
}
