import { isCloud } from "./config.js";

// The inbox check: an email from MailCheap's own address that its owner replies to, so their mail app files the next
// ones, like a campaign that needs them or their summary, in their inbox instead of spam. A card in each newsletter's
// settings offers it until it's closed. It always goes to the account's owner, never to an address someone typed.
export const INBOX_CHECK_LIMIT = { limit: 3, window: "1 d" };

// MailCheap Cloud's own emails come from its domain: a self-hosted server sends them from its operator's.
export function isInboxCheckShown(newsletter, env = process.env) {
	return isCloud(env) && Boolean(newsletter) && !newsletter.dismissedNudges?.inboxCheck;
}

const SUBJECT = "Reply so MailCheap's emails reach your inbox";
const LINES = [
	"Reply to this email with anything, like “got it”.",
	"It tells your mail app you want MailCheap's emails, so the ones that matter reach your inbox instead of spam: a campaign that needs you, a problem with your domain, your summary.",
	"MailCheap only emails you about your account, never marketing.",
];
const SPAM_LINE = "Found this in spam? Mark it as not spam too.";

// Nothing in it comes from a customer, so it has nothing to escape.
export function renderInboxCheckEmail() {
	const [first, ...rest] = LINES;
	return {
		subject: SUBJECT,
		text: [...LINES, SPAM_LINE].join("\n\n"),
		html: `<div style="max-width:460px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b"><p style="margin:0 0 16px;font-size:16px;line-height:1.5;font-weight:600">${first}</p>${rest.map((line) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${line}</p>`).join("")}<p style="margin:0;font-size:13px;line-height:1.5;color:#71717a">${SPAM_LINE}</p></div>`,
	};
}
