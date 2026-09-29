import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { AssignedTasksData } from "@/types/my-tasks";

type AssignedTasksOptions = {
  workspaceId?: string;
};

async function fetchPage(page: number, options: AssignedTasksOptions = {}) {
  const response = await client.user.tasks.$get({
    query: {
      ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
      ...(page > 1 ? { page: String(page) } : {}),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, "Failed to fetch assigned tasks");
  }

  return response.json();
}

/**
 * Loads every open task assigned to the user, like the project board loads a
 * whole project. The API bounds each request, so the pages after the first
 * are fetched together and merged; tasks are keyed by id because a task edited
 * between two requests can move across the page boundary.
 *
 * When `workspaceId` is given, only tasks in that workspace are returned.
 */
async function getAssignedTasks(
  options: AssignedTasksOptions = {},
): Promise<AssignedTasksData> {
  const first = await fetchPage(1, options);
  const rest = await Promise.all(
    Array.from({ length: first.pagination.totalPages - 1 }, (_, index) =>
      fetchPage(index + 2, options),
    ),
  );

  const tasks = new Map<string, AssignedTasksData["tasks"][number]>();
  const projects = new Map<string, AssignedTasksData["projects"][number]>();
  for (const page of [first, ...rest]) {
    for (const task of page.data.tasks) tasks.set(task.id, task);
    for (const project of page.data.projects) projects.set(project.id, project);
  }

  return { tasks: [...tasks.values()], projects: [...projects.values()] };
}

export default getAssignedTasks;
