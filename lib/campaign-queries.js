import { Types } from "mongoose";
import { scoped } from "@/lib/account-scope";
import Campaign from "@/models/Campaign";
import Contact from "@/models/Contact";

const SENT_OR_SCHEDULED = ["scheduled", "sending", "paused", "sent"];

// When the account's other issues went out, newest first. A schedule counts as the time picked, before
// and after it sends.
export function sendTimesPipeline({ accountId, newsletterId, excludeId, limit = 20 }) {
	return [
		{
			$match: {
				accountId,
				_id: { $ne: excludeId },
				status: { $in: SENT_OR_SCHEDULED },
				...(newsletterId && { newsletterId }),
			},
		},
		{ $project: { status: 1, at: { $ifNull: ["$scheduledAt", "$startedAt", "$sentAt"] } } },
		{ $match: { at: { $type: "date" } } },
		{ $sort: { at: -1 } },
		{ $limit: limit },
	];
}

// The fields campaign lists show, picked before sorting: issues also carry their HTML and the data
// other sites render them from (up to 200 KB each).
const LIST_FIELDS = {
	newsletterId: 1,
	subject: 1,
	status: 1,
	stats: 1,
	thumbnailUrl: 1,
	archiveSlug: 1,
	scheduledAt: 1,
	startedAt: 1,
	sentAt: 1,
	updatedAt: 1,
};

// Sent issues sort by send date, scheduled ones by the time they go out (so upcoming sends lead) and
// drafts by their last edit: imported issues all share the import time as updatedAt and createdAt.
export function recentCampaignsPipeline({ accountId, limit, newsletterId, status, fields = LIST_FIELDS }) {
	return [
		{ $match: { accountId, status: status ?? { $ne: "canceled" }, ...(newsletterId && { newsletterId }) } },
		{ $project: fields },
		{
			$addFields: {
				activityAt: { $ifNull: ["$sentAt", "$startedAt", "$scheduledAt", "$updatedAt"] },
			},
		},
		{ $sort: { activityAt: -1, _id: -1 } },
		{ $limit: limit },
	];
}

// Campaigns that started sending: the next one's place in the account's warm-up (lib/send-spread.js).
export function countStartedCampaigns(account) {
	return Campaign.countDocuments(scoped(account, { startedAt: { $ne: null } }));
}

// Active contacts this account never emailed: a send to more than the first slice goes in steps (lib/first-send.js).
export function countNewContacts(account, newsletterId) {
	return Contact.countDocuments(scoped(account, { newsletterId, status: "active", lastSentAt: null }));
}

// The dashboard's lists: one newsletter's campaigns, in the account's own data.
export function listNewsletterCampaigns(account, newsletterId, limit) {
	const { accountId } = scoped(account);
	return Campaign.aggregate(recentCampaignsPipeline({ accountId, newsletterId: new Types.ObjectId(String(newsletterId)), limit }));
}
