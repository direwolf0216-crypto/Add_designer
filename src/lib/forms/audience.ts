// Per-viewer field access: a field can be hidden from, or locked for, roles and teams. Admins bypass
// everything, since they are the ones configuring it.
import type { FieldAudience, FormLayout } from "./types";

export interface Viewer {
  role: string;
  customRoleId?: string | null;
  teamIds: string[];
}

export const AUDIENCE_PREFIX = { role: "role:", custom: "custom:", team: "team:" } as const;

/** The tokens that describe this viewer, matched against a field's audience lists. */
export function viewerTokens(viewer: Viewer): string[] {
  const tokens = [`${AUDIENCE_PREFIX.role}${viewer.role}`];
  if (viewer.customRoleId) tokens.push(`${AUDIENCE_PREFIX.custom}${viewer.customRoleId}`);
  viewer.teamIds.forEach((id) => tokens.push(`${AUDIENCE_PREFIX.team}${id}`));
  return tokens;
}

const matches = (list: string[] | undefined, tokens: string[]) => !!list?.some((t) => tokens.includes(t));

export const isHiddenFor = (audience: FieldAudience | undefined, viewer: Viewer) =>
  viewer.role !== "ADMIN" && matches(audience?.hideFor, viewerTokens(viewer));

export const isReadOnlyFor = (audience: FieldAudience | undefined, viewer: Viewer) =>
  viewer.role !== "ADMIN" && !isHiddenFor(audience, viewer) && matches(audience?.readOnlyFor, viewerTokens(viewer));

/**
 * The layout as this viewer should get it: hidden fields removed, locked fields flagged. Returns the same
 * object when nothing applies, so memoised consumers do not re-run.
 */
export function layoutForViewer<T extends FormLayout | null | undefined>(layout: T, viewer: Viewer | null): T {
  if (!layout || !layout.sections || !viewer || viewer.role === "ADMIN") return layout;
  const tokens = viewerTokens(viewer);
  const touched = layout.sections.some((s) => s.fields?.some((f) => matches(f.audience?.hideFor, tokens) || matches(f.audience?.readOnlyFor, tokens)));
  if (!touched) return layout;
  return {
    ...layout,
    sections: layout.sections.map((s) => ({
      ...s,
      fields: (s.fields ?? [])
        .filter((f) => !matches(f.audience?.hideFor, tokens))
        .map((f) => (matches(f.audience?.readOnlyFor, tokens) ? { ...f, lockedForViewer: true } : f)),
    })),
  } as T;
}

/** True when the field has any audience restriction configured. */
export const hasAudience = (audience: FieldAudience | undefined) => !!audience && ((audience.hideFor?.length ?? 0) > 0 || (audience.readOnlyFor?.length ?? 0) > 0);
