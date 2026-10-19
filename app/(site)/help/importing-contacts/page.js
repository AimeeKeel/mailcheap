import Link from "next/link";
import ArticleHelp from "@/components/ArticleHelp";
import { FIRST_SEND, isCloud } from "@/lib/config";
import { MAX_CONTACT_FIELDS } from "@/lib/contact-fields";
import { getHelpHref, getHelpPageMetadata } from "@/lib/help";
import { CONSENT_TEXT } from "@/lib/import-checks";

export const metadata = getHelpPageMetadata("importing-contacts");

export default function ImportingContactsPage() {
	return (
		<ArticleHelp slug="importing-contacts">
			<h2 id="export">Export from your current platform</h2>
			<p>
				Substack, beehiiv, Mailchimp, Kit, Buttondown and most other platforms export subscribers as a CSV file. Then, on the Contacts
				page, click Import contacts and choose the file.{isCloud() && " Importing needs a plan."}
			</p>
			<p>
				From beehiiv: open{" "}
				<a href="https://app.beehiiv.com/settings/publication/export_data" target="_blank" rel="noopener">
					Settings, then Export data
				</a>
				, and under Export subscribers (full version), click Export all subscribers, so custom fields, tags and stats come along.
				beehiiv emails you the file; it&apos;s also under Historical exports on that page, with a Download link. The quick version
				works too, but only brings email and status.
			</p>

			<h2 id="columns">What the import reads</h2>
			<ul>
				<li>
					<strong>Email</strong>: the only column it needs, under names like email, email address or subscriber.
				</li>
				<li>
					<strong>Status</strong>: subscribed, unsubscribed, bounced or complained in the platform&apos;s own words. A status it
					doesn&apos;t know, like unconfirmed, makes the contact dormant.
				</li>
				<li>
					<strong>Signup date</strong>, so your contacts keep the day they joined.
				</li>
				<li>
					<strong>Open and click rates</strong>, when the platform exports them: your sends reach the most engaged first, so your
					best readers get your first issue first.
				</li>
				<li>
					<strong>Opens and clicks</strong>: the last open and click, and how many emails each person opened and clicked, when the
					export has them (beehiiv&apos;s full export does). Segments on opens and clicks work from your first day.
				</li>
			</ul>
			<p>
				The other columns are listed under Other columns, each going where you pick: a first name, tags, one of your fields, a new
				field named after the column, or nowhere. MailCheap picks on its own: the first name (First Name, first_name, or the first
				word of a Name column), tags (Tags, Groups), and a new field for each custom field and for where readers came from
				(beehiiv&apos;s acquisition source, channel, campaign and referring URL), as text, a number or a date from its values. The
				platform&apos;s own columns, like ids, plans, revenue, counters and devices, stay on Skip. Check the list before you import.
			</p>
			<p>
				A tags column can list several, separated by commas. Tag everyone in this import adds tags to the whole file, to find these
				contacts later. An account holds up to {MAX_CONTACT_FIELDS} fields: past that, the other columns stay on Skip. The next
				import puts the same columns into your fields on its own.
			</p>
			<p>
				For contacts already in your list, a first name and fields in the file replace theirs, and tags are added to theirs. Instead
				of the file&apos;s statuses, you can import everyone as dormant, for an old list you&apos;d rather wake up slowly: dormant
				contacts get nothing until you mark them active.
			</p>

			<h2 id="consent">Consent</h2>
			<p>
				Before importing, you tick &ldquo;{CONSENT_TEXT}&rdquo;. Only import people who signed up for your newsletter: a bought or
				scraped list brings bounces and spam complaints, which pause your sends and can block your account.
			</p>

			<h2 id="left-out">What it leaves out</h2>
			<p>The import checks each address and leaves out, with a count for each reason:</p>
			<ul>
				<li>invalid addresses, and misspelled domains like gmial.com;</li>
				<li>spam traps, throwaway inboxes and role addresses like info@ or support@;</li>
				<li>duplicates in the file, and addresses on domains that can&apos;t receive email;</li>
				<li>people who unsubscribed, bounced or complained before, even if you deleted them since;</li>
				<li>addresses MailCheap knows can&apos;t receive email, because they bounced or hit a spam trap for any sender.</li>
			</ul>
			<p>
				Contacts already in your list keep their status, unless the file gives a stricter one (unsubscribed, bounced or complained),
				which is final. An import never sends welcome emails.
			</p>

			<h2 id="after">After the import</h2>
			<p>
				The first time you send to contacts who never got an email from you, a slice of them goes first and the rest follows{" "}
				{FIRST_SEND.waitMinutes / 60} hours later if the slice looks clean.{" "}
				<Link href={getHelpHref("sending", "first-send")}>First sends in steps</Link>
			</p>
			{isCloud() && (
				<p>
					Your active contacts count toward your plan&apos;s subscribers. With more than it allows, sending waits until you upgrade.{" "}
					<Link href={getHelpHref("plans")}>Plans and billing</Link>
				</p>
			)}
		</ArticleHelp>
	);
}
