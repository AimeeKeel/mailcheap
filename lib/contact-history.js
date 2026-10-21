// What happened to a contact besides its emails (lib/contact-emails.js), newest first, for its page's timeline: how it
// came in, signing up again, its confirmation, the status changes made by hand or through the API and MCP (lib/
// contact-status.js), an unsubscribe of its own and the list hygiene stopping it. A change made by hand also moves the
// contact's dates, and an import can set them as it adds the contact: those dates say nothing more, so they don't show.
const SAME_TIME_MS = 60_000;

function isNear(date, other) {
	return Math.abs(new Date(date).getTime() - new Date(other).getTime()) < SAME_TIME_MS;
}

export function getContactHistory(contact) {
	const changes = (contact.statusChanges ?? []).filter(({ at }) => at);
	const added = contact.createdAt ?? contact.subscribedAt;
	const isChangeAt = (date, matches) => changes.some((change) => matches(change) && isNear(change.at, date));
	const signedUpAgain =
		added &&
		contact.subscribedAt &&
		new Date(contact.subscribedAt).getTime() - new Date(added).getTime() >= SAME_TIME_MS &&
		!isChangeAt(contact.subscribedAt, ({ from, to }) => from === "unsubscribed" && to === "active");
	const events = [
		added && { type: "added", at: added },
		signedUpAgain && { type: "signed-up-again", at: contact.subscribedAt },
		contact.confirmedAt && !isChangeAt(contact.confirmedAt, ({ from }) => from === "pending") && { type: "confirmed", at: contact.confirmedAt },
		...changes.map(({ from, to, at, via, consent }) => ({ type: "status", at, from, to, via: via ?? null, consent: consent === true })),
		contact.unsubscribedAt &&
			!(added && isNear(contact.unsubscribedAt, added)) &&
			!isChangeAt(contact.unsubscribedAt, ({ to }) => to === "unsubscribed") && { type: "unsubscribed", at: contact.unsubscribedAt },
		contact.undeliverableAt && { type: "stopped", at: contact.undeliverableAt, reason: contact.undeliverableReason ?? null },
	].filter(Boolean);
	return events.toSorted((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
