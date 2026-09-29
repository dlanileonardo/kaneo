import { describe, expect, it } from "vite-plus/test";
import { filterTasksByScope } from "@/hooks/use-my-tasks-view";
import type Task from "@/types/task";

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function task(id: string, dueDate: string | null): Task {
  return {
    id,
    title: id,
    number: null,
    description: null,
    status: "to-do",
    priority: null,
    startDate: null,
    dueDate,
    position: null,
    createdAt: new Date().toISOString(),
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "p1",
  };
}

describe("filterTasksByScope", () => {
  const overdue = task("overdue", YESTERDAY);
  const today = task("today", new Date().toISOString());
  const upcoming = task("upcoming", TOMORROW);
  const undated = task("undated", null);
  const tasks = [overdue, today, upcoming, undated];

  it("returns every task for the all scope", () => {
    expect(filterTasksByScope(tasks, "all").map((t) => t.id)).toEqual([
      "overdue",
      "today",
      "upcoming",
      "undated",
    ]);
  });

  it("keeps only past-due tasks for the overdue scope", () => {
    expect(filterTasksByScope(tasks, "overdue").map((t) => t.id)).toEqual([
      "overdue",
    ]);
  });

  it("keeps only tasks due today for the today scope", () => {
    expect(filterTasksByScope(tasks, "today").map((t) => t.id)).toEqual([
      "today",
    ]);
  });

  it("keeps only future tasks for the upcoming scope", () => {
    expect(filterTasksByScope(tasks, "upcoming").map((t) => t.id)).toEqual([
      "upcoming",
    ]);
  });

  it("never includes tasks without a due date outside the all scope", () => {
    for (const scope of ["overdue", "today", "upcoming"] as const) {
      expect(filterTasksByScope([undated], scope)).toEqual([]);
    }
  });
});
