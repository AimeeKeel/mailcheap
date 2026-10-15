import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { EDITOR_PANELS, readPanel, restorePanels } from "../lib/editor-panels.js";

const { checklist, preview } = EDITOR_PANELS;
const BOTH_OPEN = { [checklist.key]: "1", [preview.key]: "1" };

// What the campaign editor's inline script and its first render read in the browser: localStorage, the screen's
// width, and the editor's root with its Checklist and Preview toggles.
function browse({ stored = {}, isWide = true, isStorageBlocked = false } = {}) {
	const root = { attributes: {}, toggles: {} };
	root.setAttribute = (name, value) => (root.attributes[name] = value);
	root.querySelector = (selector) => {
		const name = /^\[data-toggle="(\w+)"\]$/.exec(selector)[1];
		return { setAttribute: (attribute, value) => (root.toggles[name] = { [attribute]: value }) };
	};
	const storage = {
		getItem(key) {
			if (isStorageBlocked) throw new Error("The operation is insecure.");
			return stored[key] ?? null;
		},
	};
	const matchMedia = (query) => ({ matches: isWide && query === preview.media });
	Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
	Object.assign(globalThis, { matchMedia, window: { matchMedia }, document: { currentScript: { parentElement: root } } });
	return root;
}

// As the page sends it: source text, run on its own.
function runInlineScript() {
	new Function(`(${restorePanels})(${JSON.stringify(EDITOR_PANELS)})`)();
}

afterEach(() => {
	for (const name of ["localStorage", "matchMedia", "window", "document"]) delete globalThis[name];
});

test("a reload paints the checklist and the docked preview as they were left, and React's first render agrees", () => {
	const root = browse({ stored: BOTH_OPEN });
	runInlineScript();
	assert.deepEqual(root.attributes, { "data-checklist": "", "data-preview": "" });
	assert.deepEqual(root.toggles, { checklist: { "aria-pressed": "true" }, preview: { "aria-pressed": "true" } });
	assert.equal(readPanel(checklist), true);
	assert.equal(readPanel(preview), true);
});

test("the preview only comes back on screens wide enough to dock it beside the editor", () => {
	const root = browse({ stored: BOTH_OPEN, isWide: false });
	runInlineScript();
	assert.deepEqual(root.attributes, { "data-checklist": "" });
	assert.deepEqual(Object.keys(root.toggles), ["checklist"]);
	assert.equal(readPanel(checklist), true);
	assert.equal(readPanel(preview), false);
});

test("panels start closed when they were closed, when storage is blocked and on the server", () => {
	for (const options of [{ stored: { [checklist.key]: "0" } }, { stored: BOTH_OPEN, isStorageBlocked: true }]) {
		const root = browse(options);
		assert.doesNotThrow(runInlineScript);
		assert.deepEqual(root.attributes, {});
		assert.equal(readPanel(checklist), false);
		assert.equal(readPanel(preview), false);
	}
	browse({ stored: BOTH_OPEN });
	delete globalThis.window;
	assert.equal(readPanel(checklist), false);
});
