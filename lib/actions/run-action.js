import "server-only";
import { ERROR_CODES, getBlockedMessage, hasActiveSubscription, isBlocked, isDeletionPending } from "@/lib/account-state";
import { canKeyUse } from "@/lib/actions/define-action";
import { ERRORS, actionError, formatIssues } from "@/lib/actions/errors";
import { getAction } from "@/lib/actions/registry";
import { getKeyLevel } from "@/lib/api-keys";
import { connectDb } from "@/lib/db";
import { isRateLimited } from "@/lib/rate-limit";

// The one way in for the dashboard (via "dashboard", a signed-in user), the REST API ("api") and MCP
// ("mcp"), with an API key or, on MCP, an app connected with OAuth (connection, full access, with its user).
// Same permission, plan, rate limit and input checks for all of them. Throws errors with a code from
// lib/actions/errors.js.
export async function runAction(name, { account, input = {}, via, user = null, apiKey = null, connection = null }) {
	const action = getAction(name);
	if (!action) throw actionError("not_found", `There's no ${name} action`);
	if (isDeletionPending(account)) throw actionError("unauthorized", "This account is being deleted");
	if (apiKey && !canKeyUse(getKeyLevel(apiKey), action)) {
		throw actionError("forbidden", `This key can only add contacts: ${name} needs a full access key`);
	}
	if (isBlocked(account) && !action.whileBlocked) throw actionError(ERROR_CODES.accountBlocked, getBlockedMessage(account));
	const isTrial = via === "dashboard" && action.tryWithoutPlan;
	if (action.requiresPlan && !isTrial && !hasActiveSubscription(account)) {
		throw actionError(ERROR_CODES.subscriptionRequired, "The account has no active plan");
	}
	const limitKey = apiKey ? String(apiKey._id) : connection && `oauth-${connection.id}`;
	if (limitKey && action.rateLimit) {
		const limit = { name: `api-${name}`, ...action.rateLimit, key: limitKey };
		if (await isRateLimited(limit)) throw actionError("rate_limited", `Too many ${name} calls, try again later`);
	}
	const schema = via === "dashboard" && action.dashboardInput ? action.input.extend(action.dashboardInput.shape) : action.input;
	const parsed = schema.safeParse(input ?? {});
	if (!parsed.success) throw actionError("validation_failed", formatIssues(parsed.error.issues));

	await connectDb();
	try {
		return await action.handler({ account, input: parsed.data, via, user, apiKey, connection });
	} catch (error) {
		if (!Object.hasOwn(ERRORS, error?.code ?? "")) console.error(`[actions] ${name} failed:`, error);
		throw error;
	}
}
