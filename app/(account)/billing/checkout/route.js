import { redirect } from "next/navigation";
import { hasActiveSubscription } from "@/lib/account-state";
import { runDashboardAction } from "@/lib/actions/dashboard";
import { getCurrentAccount } from "@/lib/auth";
import { getPlan, isOnFreePlan, readInterval } from "@/lib/plans";

// A plan button on the public pages: Stripe Checkout for that plan, as the plan picker opens it. Accounts that
// already pay get the billing page, where a plan change is confirmed on Stripe; one on a free plan gets Checkout.
export async function GET(request) {
	const url = new URL(request.url);
	const plan = getPlan(url.searchParams.get("plan"));
	const interval = readInterval(url.searchParams.get("interval"));
	const current = await getCurrentAccount();
	if (!current) redirect(`/signin?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	if (!plan || (hasActiveSubscription(current.account) && !isOnFreePlan(current.account))) redirect(`/billing?interval=${interval}`);

	const { output, failure } = await runDashboardAction("change_plan", { plan: plan.id, interval });
	redirect(failure ? `/billing?interval=${interval}&error=stripe` : output.url);
}
