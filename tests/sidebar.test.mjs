import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LayoutDashboard from "../components/LayoutDashboard.jsx";
import NavSidebar from "../components/NavSidebar.jsx";
import { TooltipProvider } from "../components/ui/tooltip.jsx";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE, SIDEBAR_EXPANDED } from "../lib/sidebar.js";
import { runWithRequest } from "./stubs/next-headers.mjs";

// The dashboard's sidebar folds down to its icons from the button next to the logo, and opens again from the logo. The
// button saves the choice in a cookie, which the layout reads to render the next page's sidebar the same way.
const USER = { name: "Ada", email: "ada@example.com", image: null };
const ACCOUNT = { _id: "6ad8aca8d652cc82ddbb1086", status: "active" };
const LINKS = ["Overview", "Campaigns", "Contacts", "Settings", "Domains", "API keys"];

async function findSidebarProps(cookie) {
	const jar = new Map(cookie === undefined ? [] : [[SIDEBAR_COOKIE, cookie]]);
	const layout = await runWithRequest({ jar }, () => LayoutDashboard({ user: USER, account: ACCOUNT, isAdmin: false, children: null }));
	return findElement(layout, NavSidebar).props;
}

function findElement(node, type) {
	if (Array.isArray(node)) return node.map((child) => findElement(child, type)).find(Boolean) ?? null;
	if (!isValidElement(node)) return null;
	return node.type === type ? node : findElement(node.props.children, type);
}

function renderSidebar(isCollapsed) {
	return renderToStaticMarkup(
		createElement(TooltipProvider, null, createElement(NavSidebar, { isCollapsed, isAdmin: false, switcher: null, footer: null }))
	);
}

// The opening tag of the element named by this aria-label.
function findTag(html, label) {
	return html.match(new RegExp(`<[a-z]+\\b[^>]*aria-label="${label}"[^>]*>`))?.[0] ?? null;
}

// What sits inside the element the inert wrapper opens, up to the expand button that follows it.
function findInertPart(html) {
	const start = html.indexOf(' inert=""');
	return start === -1 ? "" : html.slice(start, html.indexOf('aria-label="Expand sidebar"', start));
}

describe("the dashboard's sidebar", () => {
	test("renders folded only when the cookie says so", async () => {
		assert.equal((await findSidebarProps(undefined)).isCollapsed, false, "open by default");
		assert.equal((await findSidebarProps(SIDEBAR_COLLAPSED)).isCollapsed, true);
		assert.equal((await findSidebarProps(SIDEBAR_EXPANDED)).isCollapsed, false);
		for (const value of ["COLLAPSED", "1", "true", ""]) assert.equal((await findSidebarProps(value)).isCollapsed, false, value);
	});

	test("open, shows the logo with the collapse button next to it, and the expand button can't be reached", () => {
		const html = renderSidebar(false);
		assert.doesNotMatch(html, /data-sidebar-collapsed/);
		assert.ok(findTag(html, "Collapse sidebar"));
		assert.match(findTag(html, "Expand sidebar"), / inert=""/);
		assert.equal(findInertPart(html).includes("Collapse sidebar"), false, "the logo and the collapse button work");
		assert.match(html, /<a[^>]*href="\/"[^>]*>.*?MailCheap<\/span><\/a>/);
	});

	test("folded, the logo opens it again, and every link keeps its name", () => {
		const html = renderSidebar(true);
		assert.match(html, /<aside data-sidebar-collapsed=""/);
		assert.doesNotMatch(findTag(html, "Expand sidebar"), / inert=""/);
		const inert = findInertPart(html);
		assert.ok(inert.includes('href="/"') && inert.includes('aria-label="Collapse sidebar"'), "the logo's link and the collapse button wait");
		for (const label of LINKS) assert.match(html, new RegExp(`<span class="sidebar-label">${label}</span>`), label);
	});
});
