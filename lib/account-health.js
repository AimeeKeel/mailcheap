import "server-only";
import { blockAccount } from "@/lib/account-blocks";
import { connectDb } from "@/lib/db";
import { ACCOUNT_CHECK_DAYS, getAccountBlockReason } from "@/lib/sending-rules";
import Account from "@/models/Account";
import Message from "@/models/Message";

// A burst of bounces runs the check once a minute at most, not once per event.
const CHECK_INTERVAL_MS = 60_000;
const COUNTED_KINDS = ["campaign", "last-chance", "welcome", "confirmation"];

async function claimCheck(accountId, now) {
	const cutoff = new Date(now.getTime() - CHECK_INTERVAL_MS);
	const { modifiedCount } = await Account.updateOne(
		{ _id: accountId, $or: [{ "health.checkedAt": { $lt: cutoff } }, { "health.checkedAt": null }] },
		{ $set: { "health.checkedAt": now } }
	);
	return modifiedCount > 0;
}

export async function countRecentSends(accountId, now = new Date()) {
	const since = new Date(now.getTime() - ACCOUNT_CHECK_DAYS * 24 * 60 * 60 * 1000);
	const [counts] = await Message.aggregate([
		{ $match: { accountId, sentAt: { $gte: since }, kind: { $in: COUNTED_KINDS } } },
		{
			$group: {
				_id: null,
				sent: { $sum: 1 },
				delivered: { $sum: { $cond: [{ $ifNull: ["$deliveredAt", false] }, 1, 0] } },
				bounced: { $sum: { $cond: [{ $ifNull: ["$bouncedAt", false] }, 1, 0] } },
				complained: { $sum: { $cond: [{ $ifNull: ["$complainedAt", false] }, 1, 0] } },
			},
		},
	]);
	return { sent: counts?.sent ?? 0, delivered: counts?.delivered ?? 0, bounced: counts?.bounced ?? 0, complained: counts?.complained ?? 0 };
}

// After each bounce or complaint: per-campaign limits catch one bad send, this catches an account whose sends
// are each just under them. Over the limits, the whole account is blocked until an admin unblocks it.
// isUrgent: runs even within a minute of the last check.
export async function checkAccountHealth(accountId, { now = new Date(), isUrgent = false } = {}) {
	await connectDb();
	if (!(await claimCheck(accountId, now)) && !isUrgent) return null;
	const counts = await countRecentSends(accountId, now);
	const ratio = (value) => (counts.sent ? value / counts.sent : 0);
	await Account.updateOne(
		{ _id: accountId },
		{
			$set: {
				"health.sent": counts.sent,
				"health.delivered": counts.delivered,
				"health.bounceRate": ratio(counts.bounced),
				"health.complaintRate": ratio(counts.complained),
			},
		}
	);
	const reason = getAccountBlockReason(counts);
	if (reason) await blockAccount(accountId, { reason, by: "rates" });
	return { ...counts, reason };
}
