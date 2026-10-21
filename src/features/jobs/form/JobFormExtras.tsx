"use client";

/**
 * EXTENSION POINT — job-form inputs that live outside the dynamic JOB_FORM layout.
 *
 * Rendered by JobFormDialog right after the client section (the section holding `fld_b_client`,
 * or the first section). It currently renders nothing; the "Assigned to" picker goes here.
 *
 * How to build on it:
 * - Read state with `useJobFormContext()` (`./JobFormContext`): `form` (react-hook-form),
 *   `job` (null when creating), `teamUsers` / `usersWithAvailability`, `isVisible`.
 * - Values written with `form.setValue("<key>", value)` are submitted with the job: they reach
 *   saveJobAction's FormData unchanged (arrays are joined with ", ", objects JSON-encoded), because
 *   the job schema passes unknown keys through.
 * - The form is `reset()` when it opens (edit pre-fill / create defaults), which clears such keys:
 *   pre-fill them from `job` in an effect keyed on `job?.id`.
 * - Keep the save flow a single saveJobAction call; anything needing its own API call should run
 *   after a successful save or be folded into the server action.
 */
export default function JobFormExtras() {
  return null;
}
