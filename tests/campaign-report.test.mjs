import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { default: CampaignReport } = await import("../components/CampaignReport.jsx");

const STATS = { recipients: 1000, sent: 1000, delivered: 990, opened: 462, clicked: 70, bounced: 10, complained: 1, unsubscribed: 4 };

function renderReport(props = {}) {
	return renderToStaticMarkup(
		createElement(CampaignReport, {
			campaign: { _id: "6ad87a2affc219b3be2cc72c", subject: "Hello", status: "sent", format: "markdown", markdown: "Hi", stats: STATS },
			newsletter: { name: "Weekly", fromName: "Weekly", fromEmail: "hi@example.com" },
			providers: [],
			links: null,
			comparison: { isSettled: true, issues: 3, delta: { opened: 0.042, clicked: -0.004 }, average: { opened: 0.42, clicked: 0.074 } },
			timeZone: "UTC",
			...props,
		})
	);
}

const card = (label) => `>${label}</span>`;

test("the report's cards are delivered, opened, clicked, bounced and unsubscribed, with complaints only for an admin", () => {
	const owner = renderReport();
	const cards = ["Delivered", "Opened", "Clicked", "Bounced", "Unsubscribed"].map((label) => owner.indexOf(card(label)));
	assert.ok(cards.every((index, position) => index > (cards[position - 1] ?? -1)), "all five, in that order");
	assert.ok(!owner.includes(card("Complaints")), "the owner sees complaints by inbox instead");

	const admin = renderReport({ readOnly: true });
	assert.ok(admin.indexOf(card("Bounced")) < admin.indexOf(card("Complaints")));
	assert.ok(admin.indexOf(card("Complaints")) < admin.indexOf(card("Unsubscribed")));
});

test("the report compares opens and clicks with the average in percent, never in points", () => {
	const html = renderReport();
	assert.ok(html.includes("+4.2%"));
	assert.ok(html.includes("−0.4%"));
	assert.ok(!/\bpts\b/.test(html));
});
