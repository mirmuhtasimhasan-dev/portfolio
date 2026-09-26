import { projects, type Project } from "@/data/projects";
import { tools } from "@/data/tools";

/*
 * "Used in" is computed from projects[].stack, so adding a project connects
 * its tools automatically. Nothing here is hand-maintained.
 */

export const toolNames = new Set(tools.map((t) => t.name));

/** Projects whose stack includes the tool. */
export const usedIn = (toolName: string): Project[] =>
  projects.filter((p) => p.stack.includes(toolName));

/** Featured projects (the ones with billboards) that used the tool. */
export const featuredUsing = (toolName: string): Project[] =>
  usedIn(toolName).filter((p) => p.featured);

/** Stack entries that do not match any tool (should be empty). */
export const unknownStackNames = (): { project: string; name: string }[] =>
  projects.flatMap((p) =>
    p.stack.filter((n) => !toolNames.has(n)).map((name) => ({ project: p.slug, name }))
  );

if (process.env.NODE_ENV !== "production") {
  for (const { project, name } of unknownStackNames()) {
    console.warn(`[data] ${project}: stack entry "${name}" is not in data/tools.ts`);
  }
}
