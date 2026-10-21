// Staff availability for the job form's user pickers: a user is "busy" when another job on the same
// date and time references their id anywhere in its customData.

export interface AvailabilityJob {
  id: string;
  date?: unknown;
  time?: string | null;
  customData?: unknown;
}

export function withAvailability<U extends { id: string }>(
  users: U[],
  jobsOnDate: AvailabilityJob[],
  currentJobId: string | null | undefined,
  date: string | undefined,
  time: string | undefined
): (U & { isBusy: boolean })[] {
  return users.map((user) => {
    const isBusy = jobsOnDate.some((b) => {
      if (currentJobId && b.id === currentJobId) return false;

      const bDateStr = typeof b.date === "string" ? b.date.split("T")[0] : "";
      if (bDateStr === date && b.time === time && b.customData) {
        return Object.values(b.customData as Record<string, unknown>).some(
          (val) => typeof val === "string" && val.includes(user.id)
        );
      }
      return false;
    });
    return { ...user, isBusy };
  });
}
