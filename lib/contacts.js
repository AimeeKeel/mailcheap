import { Types } from "mongoose";
import { scoped } from "@/lib/account-scope";
import { withEngagement } from "@/lib/cleanup";
import { getSignupEmailProblem } from "@/lib/import-checks";
import { findDomainsWithoutMail } from "@/lib/mail-domains";
import Contact, { CONTACT_STATUSES } from "@/models/Contact";
import Newsletter from "@/models/Newsletter";
import Suppression from "@/models/Suppression";

export const CONTACTS_PAGE_SIZE = 50;

// Signup forms, add_contact and MCP, for one normalized address: what to tell the person typing it, or null.
export async function getSignupProblem(email) {
	const problem = getSignupEmailProblem(email);
	if (problem) return problem;
	const withoutMail = await findDomainsWithoutMail([email.split("@")[1]]);
	return withoutMail.size > 0 ? "This email's domain can't receive email" : null;
}

// An account's newsletters in creation order with their active contacts, counted from the index in the
// same round trip.
export function listNewslettersWithActiveCounts(account, fields) {
	return Newsletter.aggregate([
		{ $match: scoped(account) },
		{ $sort: { createdAt: 1, _id: 1 } },
		...(fields ? [{ $project: Object.fromEntries(fields.split(" ").map((field) => [field, 1])) }] : []),
		{
			$lookup: {
				from: Contact.collection.collectionName,
				localField: "_id",
				foreignField: "newsletterId",
				pipeline: [{ $match: { status: "active" } }, { $count: "count" }],
				as: "active",
			},
		},
		{ $set: { activeCount: { $ifNull: [{ $first: "$active.count" }, 0] } } },
		{ $unset: "active" },
	]);
}

function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The contacts list's filters: a newsletter and the start of an email address.
export function contactSearchFilter(account, { newsletterId, query }) {
	return scoped(account, {
		...(newsletterId && { newsletterId: new Types.ObjectId(String(newsletterId)) }),
		...(query && { email: { $regex: `^${escapeRegex(query)}` } }),
	});
}

export function countContactsByStatus(baseFilter) {
	return Promise.all(CONTACT_STATUSES.map((key) => Contact.countDocuments({ ...baseFilter, status: key }))).then((counts) =>
		Object.fromEntries(CONTACT_STATUSES.map((key, index) => [key, counts[index]]))
	);
}

// One page of the contacts list, newest first. One count per status reads only the status indexes;
// grouping the contacts would read every one.
export async function findContactsPage(account, { newsletterId, status, query, page = 1 }) {
	const baseFilter = contactSearchFilter(account, { newsletterId, query });
	const filter = { ...baseFilter, ...(status && { status }) };
	const [statusCounts, contacts] = await Promise.all([
		Promise.all(CONTACT_STATUSES.map((key) => Contact.countDocuments({ ...baseFilter, status: key }))),
		Contact.find(filter)
			.sort({ subscribedAt: -1, _id: -1 })
			.skip((page - 1) * CONTACTS_PAGE_SIZE)
			.limit(CONTACTS_PAGE_SIZE)
			.lean(),
	]);
	const counts = Object.fromEntries(CONTACT_STATUSES.map((key, index) => [key, statusCounts[index]]));
	const totalAll = statusCounts.reduce((sum, count) => sum + count, 0);
	return { contacts, counts, totalAll, total: status ? counts[status] || 0 : totalAll };
}

// Only an explicit resubscribe reverses an opt-out; bounces and complaints never reverse.
const REACTIVATABLE_STATUSES = ["unsubscribed", "dormant"];
const SUPPRESSED_STATUSES = { bounce: "bounced", complaint: "complained", manual: "unsubscribed" };

export async function upsertContact({ newsletter, email, source, resubscribe }) {
	const { accountId } = newsletter;
	const joinStatus = newsletter.requireConfirmation ? "pending" : "active";
	const suppression = await Suppression.findOne({ accountId, email }).select({ reason: 1 }).lean();
	const status = suppression ? (SUPPRESSED_STATUSES[suppression.reason] ?? "unsubscribed") : joinStatus;
	const now = new Date();
	const result = await Contact.findOneAndUpdate(
		{ accountId, newsletterId: newsletter._id, email },
		{ $setOnInsert: { status, source, subscribedAt: now } },
		{ upsert: true, returnDocument: "after", includeResultMetadata: true }
	).lean();
	const created = !result.lastErrorObject?.updatedExisting;
	const contact = result.value;

	if (created || !resubscribe || suppression) return { contact, created };
	// Signing up again is a sign of life, and brings back a contact who left or went dormant.
	if (contact.status === "active") {
		await Contact.updateOne({ accountId, _id: contact._id }, withEngagement());
		return { contact, created };
	}
	if (!REACTIVATABLE_STATUSES.includes(contact.status)) return { contact, created };
	const reactivated = await Contact.findOneAndUpdate(
		{ accountId, _id: contact._id, status: { $in: REACTIVATABLE_STATUSES } },
		withEngagement({ $set: { status: joinStatus, subscribedAt: new Date() }, $unset: { unsubscribedAt: 1 } }),
		{ returnDocument: "after" }
	).lean();
	return { contact: reactivated ?? contact, created };
}

// The click on the confirmation link. A contact that already confirmed stays as it is.
export async function confirmContact({ accountId, contactId, newsletterId }) {
	const confirmed = await Contact.findOneAndUpdate(
		{ accountId, _id: contactId, newsletterId, status: "pending" },
		withEngagement({ $set: { status: "active", confirmedAt: new Date() } }),
		{ returnDocument: "after" }
	).lean();
	if (confirmed) return { contact: confirmed, confirmed: true };
	const contact = await Contact.findOne({ accountId, _id: contactId, newsletterId }).lean();
	return { contact, confirmed: false };
}

// The "Yes, keep sending it" click in the last-chance email. It also brings back a contact who went
// dormant; unsubscribes, bounces and complaints stay as they are.
export async function keepContact({ accountId, contactId, newsletterId }) {
	const contact = await Contact.findOne({ accountId, _id: contactId, newsletterId })
		.select({ email: 1, status: 1 })
		.lean();
	if (!contact || !["active", "dormant"].includes(contact.status)) return null;
	if (contact.status === "dormant" && (await Suppression.exists({ accountId, email: contact.email }))) return null;
	return Contact.findOneAndUpdate(
		{ accountId, _id: contact._id, status: { $in: ["active", "dormant"] } },
		withEngagement({ $set: { status: "active" } }),
		{ returnDocument: "after" }
	).lean();
}
