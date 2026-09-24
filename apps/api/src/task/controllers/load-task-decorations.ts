import { inArray } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, labelTable } from "../../database/schema";

export type TaskLabelDecoration = { id: string; name: string; color: string };

export type TaskExternalLinkDecoration = {
  id: string;
  taskId: string;
  integrationId: string;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Labels and external links for a set of tasks, fetched with one query each and
 * grouped by task id, so list endpoints stay at a fixed number of round-trips
 * regardless of how many tasks they return.
 *
 * `limit`/`offset` page the related rows per task page (the board's
 * `relatedPage` contract); when omitted every label and link is returned, as
 * the assigned-tasks endpoint expects.
 */
export async function loadTaskDecorations(
  taskIds: string[],
  options: { limit?: number; offset?: number } = {},
) {
  const labelsByTask = new Map<string, TaskLabelDecoration[]>();
  const externalLinksByTask = new Map<string, TaskExternalLinkDecoration[]>();

  if (taskIds.length === 0) {
    return { labelsByTask, externalLinksByTask };
  }

  const limit = options.limit;
  const offset = options.offset ?? 0;

  const labelQuery = db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
      taskId: labelTable.taskId,
    })
    .from(labelTable)
    .where(inArray(labelTable.taskId, taskIds))
    .orderBy(labelTable.id);
  const externalLinkQuery = db
    .select()
    .from(externalLinkTable)
    .where(inArray(externalLinkTable.taskId, taskIds))
    .orderBy(externalLinkTable.id);

  const [labelsData, externalLinksData] = await Promise.all([
    limit !== undefined ? labelQuery.limit(limit).offset(offset) : labelQuery,
    limit !== undefined
      ? externalLinkQuery.limit(limit).offset(offset)
      : externalLinkQuery,
  ]);

  for (const label of labelsData) {
    if (!label.taskId) continue;
    const labels = labelsByTask.get(label.taskId) ?? [];
    labels.push({ id: label.id, name: label.name, color: label.color });
    labelsByTask.set(label.taskId, labels);
  }

  for (const externalLink of externalLinksData) {
    const links = externalLinksByTask.get(externalLink.taskId) ?? [];
    links.push({
      ...externalLink,
      metadata: parseMetadata(externalLink.metadata),
    });
    externalLinksByTask.set(externalLink.taskId, links);
  }

  return { labelsByTask, externalLinksByTask };
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
