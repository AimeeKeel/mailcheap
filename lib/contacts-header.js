// From this many contacts, a list came from an import or signups rather than by hand, so Add contact is no longer a
// button: it's By hand, under Add contacts in the Contacts page's ⋯ menu.
export const LIST_STARTED_AT = 3;

// From this many contacts, segments have people to tell apart, so the Segments page has a button.
export const SEGMENTS_FROM = 2;

// The actions at the top of the Contacts page for a newsletter with this many contacts, of any status: the buttons, then
// the ⋯ menu, in their order. Import, the way in, is always a button. The menu always starts on Add contacts, every way to
// add them (the form for their site, an import, the API, by hand), and ends on the help article. Without contacts, the
// page's card has those ways too and there's nothing to export, so the menu holds the fields. An action in both is a
// button on wider screens and in the menu on phones, where the buttons keep to a row; Add contact, the by hand way, is a
// button of its own while the list is starting.
export function getContactsHeader(count) {
	if (count === 0) return { buttons: ["import"], menu: ["add", "fields", "help"] };
	const segments = count >= SEGMENTS_FROM ? ["segments"] : [];
	if (count < LIST_STARTED_AT) return { buttons: [...segments, "fields", "add", "import"], menu: ["add", ...segments, "fields", "export", "help"] };
	return { buttons: ["segments", "fields", "import"], menu: ["add", "segments", "fields", "export", "help"] };
}
