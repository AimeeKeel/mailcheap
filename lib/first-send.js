import { LIMITS } from "./config.js";

// Contacts this account never emailed go out in steps: a slice first, then a check of its bounces and
// complaints 3 hours after it, then the rest. A bought or scraped list shows itself in the slice, before it costs
// the sending reputation every other customer shares.
export const FIRST_SEND = { share: 0.05, minSlice: 200, maxSlice: 2000, waitMinutes: 180, recheckMinutes: 10 };

// Every never-mailed contact goes at once when there are no more than the smallest slice.
export function getFirstSendSlice(neverMailed) {
	const slice = Math.min(FIRST_SEND.maxSlice, Math.max(FIRST_SEND.minSlice, Math.round(neverMailed * FIRST_SEND.share)));
	return neverMailed > slice ? slice : null;
}

function percent(value) {
	return `${(value * 100).toFixed(2)}%`;
}

// Rates over the slice's sent emails, with the per-send limits. Over them, the account is blocked with this reason.
export function getFirstSendProblem({ sent = 0, bounced = 0, complained = 0 }) {
	if (sent === 0) return null;
	if (bounced / sent > LIMITS.bounceRate) {
		return `The first ${sent} new contacts had a bounce rate of ${percent(bounced / sent)} (limit ${percent(LIMITS.bounceRate)})`;
	}
	if (complained / sent > LIMITS.complaintRate) {
		return `The first ${sent} new contacts had a complaint rate of ${percent(complained / sent)} (limit ${percent(LIMITS.complaintRate)})`;
	}
	return null;
}
