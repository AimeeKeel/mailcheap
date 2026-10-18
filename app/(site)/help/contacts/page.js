import Link from "next/link";
import ArticleHelp from "@/components/ArticleHelp";
import { TRIAL_CONTACTS } from "@/lib/actions/contacts";
import { isCloud } from "@/lib/config";
import { getHelpHref, getHelpPageMetadata } from "@/lib/help";
import { MAX_SEGMENT_CONDITIONS, SEGMENT_PRESETS, describeSegment } from "@/lib/segments";

export const metadata = getHelpPageMetadata("contacts");

export default function ContactsPage() {
	return (
		<ArticleHelp slug="contacts">
			<h2 id="statuses">Statuses</h2>
			<p>
				The Contacts page lists the open newsletter&apos;s contacts, newest signups first. Filter them by status, or search by email
				address.
			</p>
			<table>
				<thead>
					<tr>
						<th>Status</th>
						<th>What it means</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Active</td>
						<td>Gets your issues.{isCloud() && " Counts toward your plan's subscribers."}</td>
					</tr>
					<tr>
						<td>Pending</td>
						<td>Signed up and hasn&apos;t clicked the confirmation email yet. Gets nothing else until then.</td>
					</tr>
					<tr>
						<td>Dormant</td>
						<td>
							Stopped opening and didn&apos;t answer the <Link href={getHelpHref("list-cleanup")}>last-chance email</Link>, or was
							imported as dormant. Gets no issues until you reactivate them.
						</td>
					</tr>
					<tr>
						<td>Unsubscribed</td>
						<td>Unsubscribed, or you unsubscribed them. Only signing up again brings them back.</td>
					</tr>
					<tr>
						<td>Bounced</td>
						<td>Their address can&apos;t receive email. Never emailed again.</td>
					</tr>
					<tr>
						<td>Complained</td>
						<td>Marked one of your emails as spam. Never emailed again.</td>
					</tr>
				</tbody>
			</table>

			<h2 id="segments">Segments</h2>
			<p>
				A segment picks some of your contacts with a few conditions, and keeps up to date as they change. The Contacts page shows each
				one as a card with its count: click it to list its contacts, and the export follows. New segment opens the editor, with a few
				starting points:
			</p>
			<ul>
				{SEGMENT_PRESETS.map((segment) => (
					<li key={segment.name}>
						<strong>{segment.name}</strong>: {describeSegment(segment).toLowerCase()}.
					</li>
				))}
			</ul>
			<p>
				Conditions can be on opens and clicks, issues missed in a row, the number of emails opened, the signup date, where they signed
				up (the signup form, an import, by hand or the API) and the email address, {MAX_SEGMENT_CONDITIONS} at most. A segment matches
				all of its conditions, or any of them. In the send step, pick one to send an issue to its contacts only.{" "}
				<Link href={getHelpHref("sending", "who")}>Who gets it</Link>
			</p>
			<p>
				Counts are of active contacts, the ones an issue goes to. Conditions on dates count back from now, so &ldquo;opened in the last
				30 days&rdquo; follows time, and a send reads its segment when it goes out. A segment that a scheduled or sending issue goes to
				can&apos;t be deleted until that issue goes elsewhere.
			</p>

			<h2 id="add">Adding someone by hand</h2>
			<p>
				Click Add a contact and type their email address. It works like a signup on your website: they get your confirmation email if
				the newsletter confirms signups, or your welcome email if it&apos;s on.
				{isCloud() && ` Without a plan, you can add ${TRIAL_CONTACTS.limit} contacts a day, enough to try it on yourself.`}
			</p>
			<p>
				For a whole list, import a CSV file instead: <Link href={getHelpHref("importing-contacts")}>Importing contacts</Link>.
			</p>

			<h2 id="actions">Unsubscribing, reactivating and deleting</h2>
			<p>Each contact&apos;s menu has what applies to them:</p>
			<ul>
				<li>
					<strong>Reactivate</strong> brings a dormant contact back: they get your next issue.
				</li>
				<li>
					<strong>Unsubscribe</strong> stops every email to them, for good. Only they can undo it, by signing up again.
				</li>
				<li>
					<strong>Delete contact</strong> removes them with their dates and engagement, and can&apos;t be undone. For someone who
					unsubscribed, bounced or complained, MailCheap keeps a scrambled trace of the address, so adding it again never emails it.
					Anyone else can be added again like a new contact.
				</li>
			</ul>

			<h2 id="export">Exporting</h2>
			<p>
				Export downloads the contacts that match your filters as a CSV file. Its columns go back in through the import as they are, so
				it&apos;s also a backup.
			</p>

			<h2 id="undeliverable">Addresses no one can reach</h2>
			<p>
				When an address hard bounces or turns out to be a spam trap, MailCheap remembers it for every sender: imports and signups
				leave it out, and sends skip it, showing the contact as bounced. A bounced address is remembered for 180 days, a spam trap for
				good.
			</p>
		</ArticleHelp>
	);
}
