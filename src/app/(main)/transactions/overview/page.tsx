import { requirePageUser, userCan } from "@/lib/auth/session";
import { loadLedgerOverview } from "@/lib/transactions/ledgerOverview";
import LedgerView from "./LedgerView";

/**
 * The Daily Ledger. Today's figures are loaded here on the server and sent with the page, so on a
 * slow connection they appear with it instead of after the app's scripts load and ask for them.
 */
export default async function LedgerPage() {
  const user = await requirePageUser();
  const initial = (await userCan(user, "view_transactions")) ? await loadLedgerOverview(user).catch(() => null) : null;
  // Plain JSON, exactly as the API sends it (dates as strings).
  return <LedgerView initialData={initial ? JSON.parse(JSON.stringify(initial)) : undefined} />;
}
