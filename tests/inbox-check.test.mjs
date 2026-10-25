import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { activate, as, callApi, catchRedirect, form, platformEmails, signIn, startTestApp } from "./helpers/app.mjs";
import { INBOX_CHECK_LIMIT, isInboxCheckShown, renderInboxCheckEmail } from "../lib/inbox-check.js";

// The settings' inbox check: an email from MailCheap that its owner replies to, so MailCheap's next emails reach their
// inbox. Only ever to the account's own owner, a few a day, and its card closes for one newsletter at a time.
let app;
let m;

before(async () => {
	app = await startTestApp();
	m = {
		newsletters: await import("../app/(app)/newsletters/actions.js"),
		welcome: await import("../app/welcome/actions.js"),
		apiKeys: await import("../app/(app)/api-keys/actions.js"),
		Account: (await import("../models/Account.js")).default,
		Message: (await import("../models/Message.js")).default,
		Newsletter: (await import("../models/Newsletter.js")).default,
		NoticeInboxCheck: (await import("../components/NoticeInboxCheck.jsx")).default,
	};
});

after(() => app?.stop());

async function addNewsletter(user, slug) {
	const url = await as(user, () => catchRedirect(m.newsletters.saveNewsletter(null, form({ name: `${slug} news`, slug, postalAddress: "1 Main St, Paris" }))));
	return url.split("/").at(-1);
}

async function customer(email, { hasPlan = true } = {}) {
	const user = await signIn(email);
	if (hasPlan) await activate(user);
	user.newsletterId = await addNewsletter(user, email.split("@")[0]);
	return user;
}

function inboxChecksTo(address) {
	return platformEmails.filter(({ to, subject }) => to.includes(address) && subject === renderInboxCheckEmail().subject);
}

async function readClosedAt(newsletterId) {
	const newsletter = await m.Newsletter.findById(newsletterId).setOptions({ crossAccount: true }).lean();
	return newsletter.dismissedNudges?.inboxCheck ?? null;
}

test("the card shows on MailCheap Cloud until it's closed, for each newsletter on its own", () => {
	const cloud = { MAILCHEAP_CLOUD: "true" };
	assert.equal(isInboxCheckShown({ name: "Hens" }, cloud), true);
	assert.equal(isInboxCheckShown({ name: "Hens", dismissedNudges: { ownDomain: "add" } }, cloud), true, "another helper closed");
	assert.equal(isInboxCheckShown({ name: "Hens", dismissedNudges: { inboxCheck: new Date() } }, cloud), false);
	assert.equal(isInboxCheckShown({ name: "Hens" }, {}), false, "a self-hosted server sends MailCheap's emails from its own domain");
	assert.equal(isInboxCheckShown(null, cloud), false);
});

test("the email asks for a reply, says it isn't marketing, and carries nothing a customer wrote", () => {
	const email = renderInboxCheckEmail();
	assert.equal(email.subject, "Reply so MailCheap's emails reach your inbox");
	assert.match(email.text, /^Reply to this email with anything/);
	assert.match(email.text, /never marketing/);
	assert.match(email.text, /Found this in spam\? Mark it as not spam too\./);
	assert.match(email.html, /Reply to this email with anything/);
	assert.doesNotMatch(email.html, /<a\b|<img\b|https?:/, "no link or picture to look like a campaign");
});

test("the card says what to do, why, and how to close it", () => {
	const html = renderToStaticMarkup(createElement(m.NoticeInboxCheck, { newsletterId: "65f1c0ffee00000000000001" }));
	assert.match(html, /Get MailCheap&#x27;s emails in your inbox/);
	assert.match(html, /Send yourself an email from MailCheap/);
	assert.match(html, /Reply to it with anything/);
	assert.match(html, />Send me an email</);
	assert.match(html, /aria-label="Close"/);
	assert.match(html, /never for marketing/);
	assert.match(html, /bg-muted\/60/, "gray like the pace notice, not a white settings card");
});

test("it goes to the signed-in owner only, 3 a day, and never counts as one of the plan's emails", async () => {
	const user = await customer("inbox-owner@example.com");
	for (let index = 0; index < INBOX_CHECK_LIMIT.limit; index++) {
		assert.deepEqual(await as(user, () => m.newsletters.sendInboxCheck()), { sentTo: "inbox-owner@example.com" }, String(index));
	}
	assert.deepEqual(await as(user, () => m.newsletters.sendInboxCheck()), {
		error: "You can send an inbox check email 3 times a day. Try again later.",
	});
	const sent = inboxChecksTo("inbox-owner@example.com");
	assert.equal(sent.length, 3);
	assert.ok(sent.every(({ to }) => to.length === 1 && to[0] === "inbox-owner@example.com"));
	assert.ok(sent.every(({ headers }) => !headers?.["List-Unsubscribe"]), "an email they asked for, not a list");
	assert.equal(await m.Message.countDocuments({ accountId: user.accountId }), 0);
	assert.equal((await m.Account.findById(user.accountId).lean()).usage?.emailsSent ?? 0, 0);
});

test("the API sends it to the owner, whatever address it's given, and shares the account's daily limit", async () => {
	const user = await customer("inbox-api@example.com");
	const { key } = await as(user, () => m.apiKeys.createApiKey(null, form({ name: "Agent", level: "full" })));
	await as(user, () => m.newsletters.sendInboxCheck());
	await as(user, () => m.newsletters.sendInboxCheck());

	const sent = await callApi("POST", "/api/v1/inbox-check", { key, body: { to: "stranger@example.org" } });
	assert.equal(sent.status, 200, JSON.stringify(sent.body));
	assert.deepEqual(sent.body, { sentTo: "inbox-api@example.com" });
	assert.equal(inboxChecksTo("stranger@example.org").length, 0, "nobody else gets it");

	const refused = await callApi("POST", "/api/v1/inbox-check", { key });
	assert.equal(refused.status, 429);
	assert.equal(refused.body.error.code, "rate_limited");
	assert.equal(inboxChecksTo("inbox-api@example.com").length, 3);
});

test("without a plan, the dashboard sends it; the API needs one, as for every action", async () => {
	const free = await customer("inbox-free@example.com", { hasPlan: false });
	assert.deepEqual(await as(free, () => m.newsletters.sendInboxCheck()), { sentTo: "inbox-free@example.com" });

	const lapsed = await customer("inbox-lapsed@example.com");
	const { key } = await as(lapsed, () => m.apiKeys.createApiKey(null, form({ name: "Agent", level: "full" })));
	await m.Account.updateOne({ _id: lapsed.accountId }, { $set: { subscriptionStatus: "canceled" } });
	const refused = await callApi("POST", "/api/v1/inbox-check", { key });
	assert.equal(refused.status, 402);
	assert.equal(inboxChecksTo("inbox-lapsed@example.com").length, 0);
});

test("closing the card keeps it closed for that newsletter only, and nobody closes another account's", async () => {
	const owner = await customer("inbox-close@example.com");
	const second = await addNewsletter(owner, "inbox-close-second");
	const other = await customer("inbox-close-other@example.com");

	assert.deepEqual(await as(owner, () => m.welcome.dismissInboxCheck(owner.newsletterId)), { ok: true });
	const closedAt = await readClosedAt(owner.newsletterId);
	assert.ok(closedAt instanceof Date);
	assert.equal(await readClosedAt(second), null, "the account's other newsletter still shows it");

	await as(owner, () => m.welcome.dismissInboxCheck(owner.newsletterId));
	assert.equal((await readClosedAt(owner.newsletterId)).getTime(), closedAt.getTime(), "closed once, when it first went");
	await as(owner, () => m.welcome.dismissInboxCheck(other.newsletterId));
	assert.equal(await readClosedAt(other.newsletterId), null, "another account's newsletter stays as it was");
	assert.ok((await as(owner, () => m.welcome.dismissInboxCheck({ $ne: null }))).error, "only an ID");
});
