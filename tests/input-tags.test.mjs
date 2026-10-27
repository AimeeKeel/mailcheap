import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InputTags from "../components/InputTags.jsx";

// The chips field for tags (components/InputTags.jsx), in a contact's Edit fields and the import.
test("a tags field says how to add one, and keeps saying it once it has some", () => {
	const empty = renderToStaticMarkup(createElement(InputTags, { value: [], onChange() {} }));
	assert.match(empty, /placeholder="Type a tag, then press Enter"/);

	const some = renderToStaticMarkup(createElement(InputTags, { value: ["vip"], onChange() {} }));
	assert.match(some, /placeholder="Add another"/, "not an empty field after the first one");
	assert.match(some, /aria-label="Remove vip"/);

	const full = renderToStaticMarkup(createElement(InputTags, { value: ["vip", "podcast"], onChange() {}, max: 2 }));
	assert.match(full, /disabled=""/);
	assert.doesNotMatch(full, /placeholder="[^"]/, "nothing to add once it's full");
});
