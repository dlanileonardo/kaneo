import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The agenda dashboard was merged into "My tasks", which now offers the same
 * Today / Upcoming scopes (plus All and Overdue) across every workspace. Old
 * bookmarks keep working by landing on the unified view.
 */
export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agenda",
)({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/my-tasks", replace: true });
  },
});
