import { requirePageUser, userCan } from "@/lib/auth/session";
import { loadDashboardOverview } from "@/lib/dashboard/overview";
import DashboardView from "./DashboardView";

/**
 * The dashboard. This month's figures are loaded here on the server and sent with the page, so on a
 * slow connection they appear with it instead of after the app's scripts load and ask for them.
 */
export default async function DashboardPage() {
  const user = await requirePageUser();
  const initial = (await userCan(user, "view_analytics")) ? await loadDashboardOverview(user).catch(() => null) : null;
  // Plain JSON, exactly as the API sends it (dates as strings).
  return <DashboardView initialData={initial ? JSON.parse(JSON.stringify(initial)) : undefined} />;
}
