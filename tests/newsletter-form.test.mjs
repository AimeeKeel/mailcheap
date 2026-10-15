import assert from "node:assert/strict";
import { test } from "node:test";
import { getDraftConfirmation, getDraftFromEmail, getDraftKey, getNewsletterDraft } from "../lib/newsletter-form.js";

// The settings form's save bar shows while the form has unsaved changes: what saving would send, against what the
// newsletter has saved.
const sharedDomain = "mailcheapmail.com";
const newsletter = {
	_id: "n1",
	name: "Field notes",
	slug: "field-notes",
	fromName: "Jane",
	fromEmail: "hello@field-notes.mailcheapmail.com",
	postalAddress: "1 Main St, Paris",
	requireConfirmation: true,
	welcome: { enabled: false, subject: "", previewText: "", markdown: "" },
	socialLinks: ["https://x.com/example"],
};
const saved = getNewsletterDraft({ newsletter, domains: [], sharedDomain });

function hasChanges(draft) {
	return getDraftKey(draft, { newsletter, sharedDomain }) !== getDraftKey(saved, { newsletter, sharedDomain });
}

test("a draft has unsaved changes until it's back to what the newsletter has saved", () => {
	assert.equal(hasChanges(getNewsletterDraft({ newsletter, domains: [], sharedDomain })), false);
	assert.equal(hasChanges({ ...saved, postalAddress: "2 Main St, Paris" }), true);
	assert.equal(hasChanges({ ...saved, postalAddress: "1 Main St, Paris" }), false);
	assert.equal(hasChanges({ ...saved, isArchiveEnabled: true }), true);
	assert.equal(hasChanges({ ...saved, cleanup: { ...saved.cleanup, days: "90" } }), true);
	assert.equal(hasChanges({ ...saved, socialLinks: "https://x.com/example" }), false);
});

test("the confirmation email counts while new signups confirm, the welcome email otherwise", () => {
	const confirmation = getDraftConfirmation(saved, newsletter);
	assert.equal(hasChanges({ ...saved, confirmationEdits: { ...confirmation, subject: "Please confirm" } }), true);
	assert.equal(hasChanges({ ...saved, confirmationEdits: { ...confirmation } }), false, "edited back to the built-in email");
	assert.equal(hasChanges({ ...saved, name: "Field notes weekly" }), true);

	const welcome = { ...saved.welcome, subject: "Welcome" };
	assert.equal(hasChanges({ ...saved, welcome }), false, "a collapsed welcome email isn't sent");
	assert.equal(hasChanges({ ...saved, isConfirmationRequired: false }), true);
});

test("the shared address follows the slug; an own domain keeps its address", () => {
	assert.equal(getDraftFromEmail({ ...saved, slug: "notes" }, sharedDomain), "hello@notes.mailcheapmail.com");
	assert.equal(hasChanges({ ...saved, slug: "notes" }), true);
	assert.equal(hasChanges({ ...saved, fromLocal: "jane" }), false, "the shared address takes no name");

	const ownDomain = { ...newsletter, fromEmail: "jane@example.com" };
	const draft = getNewsletterDraft({ newsletter: ownDomain, domains: [{ domain: "example.com" }], sharedDomain });
	assert.deepEqual([draft.fromLocal, draft.fromDomain], ["jane", "example.com"]);
	assert.equal(getDraftFromEmail(draft, sharedDomain), "jane@example.com");
	const removed = getNewsletterDraft({ newsletter: ownDomain, domains: [], sharedDomain });
	assert.equal(getDraftFromEmail(removed, sharedDomain), "hello@field-notes.mailcheapmail.com", "a domain the account removed falls back to the shared address");
});
