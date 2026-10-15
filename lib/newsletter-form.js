import { getCleanupSettings } from "./cleanup.js";
import { getConfirmationContent } from "./confirmation-content.js";
import { getSharedAddress, isOnSharedDomain } from "./sender-rules.js";

// The settings form's fields (FormNewsletter) as the newsletter has them saved: where the form starts, and what
// Discard goes back to. Without a newsletter, a new one's.
export function getNewsletterDraft({ newsletter, domains, sharedDomain }) {
	const from = getInitialFrom({ newsletter, domains, sharedDomain });
	const cleanup = getCleanupSettings(newsletter);
	return {
		name: newsletter?.name ?? "",
		slug: newsletter?.slug ?? "",
		isSlugEdited: Boolean(newsletter),
		imageUrl: newsletter?.imageUrl ?? "",
		fromName: newsletter?.fromName ?? "",
		fromLocal: from.local,
		fromDomain: from.domain,
		replyTo: newsletter?.replyTo ?? "",
		postalAddress: newsletter?.postalAddress ?? "",
		isConfirmationRequired: newsletter ? Boolean(newsletter.requireConfirmation) : true,
		confirmationEdits: null,
		isWelcomeEnabled: Boolean(newsletter?.welcome?.enabled),
		welcome: {
			subject: newsletter?.welcome?.subject ?? "",
			previewText: newsletter?.welcome?.previewText ?? "",
			markdown: newsletter?.welcome?.markdown ?? "",
		},
		isCleanupEnabled: newsletter ? cleanup.enabled : true,
		cleanup: { issues: String(cleanup.issues), days: String(cleanup.days) },
		isArchiveEnabled: Boolean(newsletter?.archiveEnabled),
		description: newsletter?.description ?? "",
		authorBio: newsletter?.author?.bio ?? "",
		authorImageUrl: newsletter?.author?.imageUrl ?? "",
		socialLinks: newsletter?.socialLinks?.join("\n") ?? "",
	};
}

// The shared domain stands for the shared address, whose subdomain follows the slug.
export function getDraftFromEmail({ slug, fromLocal, fromDomain }, sharedDomain) {
	if (sharedDomain && fromDomain === sharedDomain) return getSharedAddress(slug || "slug", sharedDomain);
	return fromDomain ? `${fromLocal}@${fromDomain}` : "";
}

// Until it's edited, the built-in confirmation email follows the name and the description.
export function getDraftConfirmation({ name, description, confirmationEdits }, newsletter) {
	return confirmationEdits ?? getConfirmationContent({ name, description, confirmation: newsletter?.confirmation });
}

// What saving the draft sends, to tell whether it has unsaved changes. A collapsed email section sends nothing, so
// what it holds doesn't count.
export function getDraftKey(draft, { newsletter, sharedDomain }) {
	const { isSlugEdited, fromLocal, fromDomain, confirmationEdits, isWelcomeEnabled, welcome, ...fields } = draft;
	return JSON.stringify({
		...fields,
		fromEmail: getDraftFromEmail(draft, sharedDomain),
		...(draft.isConfirmationRequired
			? { confirmation: getDraftConfirmation(draft, newsletter) }
			: { isWelcomeEnabled, welcome }),
	});
}

// The saved address if it's on a domain the account can use, else the shared address, else the first domain.
function getInitialFrom({ newsletter, domains, sharedDomain }) {
	const [local = "", domain = ""] = String(newsletter?.fromEmail ?? "").split("@");
	if (isOnSharedDomain(newsletter?.fromEmail, sharedDomain)) return { local: "hi", domain: sharedDomain };
	if (domain && domains.some((item) => item.domain === domain)) return { local, domain };
	return { local: local || "hi", domain: sharedDomain ?? domains[0]?.domain ?? "" };
}
