"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { ExternalLink, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveNewsletter, sendWelcomeTest } from "@/app/(app)/newsletters/actions";
import BarSave from "@/components/BarSave";
import InputImage from "@/components/InputImage";
import NoticeWelcomePaused from "@/components/NoticeWelcomePaused";
import PreviewEmail from "@/components/PreviewEmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CLEANUP_LIMITS, LAST_CHANCE_DAYS, getCleanupSettings } from "@/lib/cleanup";
import { CONFIRM_URL_PLACEHOLDER } from "@/lib/confirmation-content";
import { formatNumber } from "@/lib/format";
import { KEEP_URL_PLACEHOLDER, getLastChanceContent } from "@/lib/last-chance-content";
import { getDraftConfirmation, getDraftFromEmail, getDraftKey, getNewsletterDraft } from "@/lib/newsletter-form";
import { MAX_AUTHOR_BIO_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/newsletters";
import { UNSUBSCRIBE_PLACEHOLDER, renderEmail } from "@/lib/render-email";
import { getSharedAddress } from "@/lib/sender-rules";
import { slugify } from "@/lib/slug";
import { usePaywall } from "@/lib/use-paywall";
import { cn } from "@/lib/utils";
import { prefillWelcome } from "@/lib/welcome-content";

const IMAGE_PREVIEW_PATTERN = /^(https:\/\/\S+\.\S{2,}\/\S+|\/\S+\.\w{3,4})$/;

// welcomePause: the notice to show while the month's emails are used up and welcome emails are skipped. It saves from
// onSubmit, not a form action: React resets a form after its action, which turned the switches back to how the page
// opened and dropped what an error refused. Discard goes back to what the newsletter has saved.
export default function FormNewsletter({ newsletter, domains, sharedDomain, isSendingEnabled, testEmail, cleanupTotals, welcomePause }) {
	const paywall = usePaywall();
	const hasPlan = paywall?.hasPlan ?? true;
	const archiveHost = domains.find(({ archiveHostVerified }) => archiveHostVerified)?.archiveHost;
	const [draft, setDraft] = useState(() => getNewsletterDraft({ newsletter, domains, sharedDomain }));
	const draftKey = getDraftKey(draft, { newsletter, sharedDomain });
	const [savedKey, setSavedKey] = useState(draftKey);
	const [savedAt, setSavedAt] = useState(null);
	// The image inputs keep their own URL: a discard starts them over.
	const [discardCount, setDiscardCount] = useState(0);
	const [isSaving, startSaving] = useTransition();
	const [isTesting, startTesting] = useTransition();
	const { name, description, slug, fromName, fromLocal, fromDomain, imageUrl, isConfirmationRequired, confirmationEdits, isWelcomeEnabled, welcome, isArchiveEnabled, isCleanupEnabled, cleanup } = draft;
	const savedCleanup = getCleanupSettings(newsletter);
	const deferredWelcome = useDeferredValue(welcome);
	const archiveAddress = archiveHost ?? (sharedDomain ? `${slug || "slug"}.${sharedDomain}` : `/archive/${slug || "slug"}`);
	const sharedAddress = sharedDomain ? getSharedAddress(slug || "slug", sharedDomain) : null;
	const fromEmail = getDraftFromEmail(draft, sharedDomain);
	const isDirty = draftKey !== savedKey;

	const welcomeHtml = useMemo(
		() =>
			renderEmail({
				markdown: deferredWelcome.markdown,
				subject: deferredWelcome.subject,
				previewText: deferredWelcome.previewText,
				newsletter: { name, postalAddress: newsletter?.postalAddress },
			}).html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#"),
		[deferredWelcome, name, newsletter?.postalAddress]
	);

	const confirmation = useMemo(
		() => getDraftConfirmation({ name, description, confirmationEdits }, newsletter),
		[name, description, confirmationEdits, newsletter]
	);
	const deferredConfirmation = useDeferredValue(confirmation);
	const confirmationHtml = useMemo(
		() =>
			renderEmail({ ...deferredConfirmation, newsletter: { name, postalAddress: newsletter?.postalAddress } })
				.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#")
				.replaceAll(CONFIRM_URL_PLACEHOLDER, "#"),
		[deferredConfirmation, name, newsletter?.postalAddress]
	);

	const lastChance = useMemo(() => {
		const content = getLastChanceContent({ name, fromEmail });
		const { html } = renderEmail({ ...content, newsletter: { name, postalAddress: newsletter?.postalAddress } });
		return {
			...content,
			html: html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#").replaceAll(KEEP_URL_PLACEHOLDER, "#"),
		};
	}, [name, fromEmail, newsletter?.postalAddress]);

	const previewImageUrl = IMAGE_PREVIEW_PATTERN.test(imageUrl) ? imageUrl : "";
	const isShared = Boolean(sharedDomain) && fromDomain === sharedDomain;
	const isDomainUnverified = !isShared && domains.some(({ domain, verified }) => domain === fromDomain && !verified);
	const fromHint = getFromHint({ isShared, isDomainUnverified, fromDomain, hasDomains: domains.length > 0 });

	function set(key, value) {
		setDraft((current) => ({ ...current, [key]: value }));
	}

	function update(key) {
		return (event) => set(key, event.target.value);
	}

	function updateConfirmation(key) {
		return (event) => {
			const { value } = event.target;
			setDraft((current) => ({ ...current, confirmationEdits: { ...(current.confirmationEdits ?? confirmation), [key]: value } }));
		};
	}

	function updateWelcome(key) {
		return (event) => {
			const { value } = event.target;
			setDraft((current) => ({ ...current, welcome: { ...current.welcome, [key]: value } }));
		};
	}

	function switchWelcome(isEnabled) {
		setDraft((current) => ({
			...current,
			isWelcomeEnabled: isEnabled,
			welcome: isEnabled ? prefillWelcome(current.welcome, { name: current.name, description: current.description }) : current.welcome,
		}));
	}

	function updateCleanup(key) {
		return (event) => {
			const { value } = event.target;
			setDraft((current) => ({ ...current, cleanup: { ...current.cleanup, [key]: value } }));
		};
	}

	function save(event) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		startSaving(async () => {
			const result = await saveNewsletter(null, formData);
			if (result?.error) return void toast.error(result.error);
			setSavedKey(draftKey);
			setSavedAt(result.savedAt);
		});
	}

	function discard() {
		const saved = getNewsletterDraft({ newsletter, domains, sharedDomain });
		setDraft(saved);
		setSavedKey(getDraftKey(saved, { newsletter, sharedDomain }));
		setSavedAt(null);
		setDiscardCount((count) => count + 1);
	}

	function sendTest() {
		if (!hasPlan) return paywall.open("test");
		startTesting(async () => {
			const result = await sendWelcomeTest(newsletter._id);
			if (result?.error) toast.error(result.error);
			else toast.success(`Test sent to ${testEmail}`);
		});
	}

	return (
		<form onSubmit={save} className="flex flex-col gap-4">
			{newsletter && <input type="hidden" name="id" value={newsletter._id} />}

			<Section title="General" stagger={0}>
				<Field label="Name">
					<Input
						name="name"
						value={name}
						required
						placeholder="Field notes"
						onChange={(event) => {
							const { value } = event.target;
							setDraft((current) => ({ ...current, name: value, ...(!current.isSlugEdited && { slug: slugify(value) }) }));
						}}
					/>
				</Field>
				<Field label="Slug">
					<Input
						name="slug"
						value={slug}
						required
						placeholder="field-notes"
						className="font-mono"
						onChange={(event) => {
							const { value } = event.target;
							setDraft((current) => ({ ...current, slug: value, isSlugEdited: true }));
						}}
					/>
				</Field>
				<Field label="Image" hint="Square logo, 128×128 or larger">
					<InputImage
						key={discardCount}
						name="imageUrl"
						defaultValue={imageUrl}
						label="newsletter image"
						onChange={(value) => set("imageUrl", value)}
					/>
				</Field>
			</Section>

			<Section title="Sender" stagger={1}>
				<Field label="From name">
					<Input name="fromName" value={fromName} placeholder="Jane Doe" onChange={update("fromName")} />
				</Field>
				<Field label="From email" hint={fromHint} isWarning={isDomainUnverified}>
					<span className="flex flex-wrap items-center gap-2">
						<span className="flex items-center gap-2">
							<Input
								value={isShared ? sharedAddress.split("@")[0] : fromLocal}
								readOnly={isShared}
								required
								aria-label="From email name"
								placeholder="hi"
								className={cn("w-32 font-mono", isShared && "text-muted-foreground")}
								onChange={(event) => set("fromLocal", event.target.value.trim())}
							/>
							<span className="text-sm text-muted-foreground">@</span>
						</span>
						{/* The shared domain has the slug in it, so it can be wider than the column. */}
						<Select value={fromDomain} onValueChange={(value) => set("fromDomain", value)}>
							<SelectTrigger
								className="min-h-9 min-w-0 flex-auto py-1.5 text-left font-mono whitespace-normal wrap-anywhere data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none"
								aria-label="From domain"
							>
								<SelectValue placeholder="Add a domain first" />
							</SelectTrigger>
							<SelectContent className="max-w-[calc(100vw-20px)] wrap-anywhere">
								{sharedDomain && <SelectItem value={sharedDomain}>{sharedAddress.split("@")[1]}</SelectItem>}
								{domains.map(({ domain }) => (
									<SelectItem key={domain} value={domain}>
										{domain}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</span>
					<input type="hidden" name="fromEmail" value={fromEmail} />
				</Field>
				<Field label="Reply-to">
					<Input name="replyTo" type="email" value={draft.replyTo} placeholder="Optional" onChange={update("replyTo")} />
				</Field>
				<Field label="Postal address" hint="Shown in the footer of every email. Anti-spam laws require one.">
					<Textarea
						name="postalAddress"
						value={draft.postalAddress}
						rows={2}
						placeholder="Company name, street, city, country"
						onChange={update("postalAddress")}
					/>
				</Field>
			</Section>

			<Section
				title="Confirm new signups"
				stagger={2}
				action={
					<Switch
						name="requireConfirmation"
						checked={isConfirmationRequired}
						onCheckedChange={(isChecked) => set("isConfirmationRequired", isChecked)}
						aria-label="Confirm new signups"
					/>
				}
			>
				<p className="px-4 py-3 text-sm text-pretty text-muted-foreground">
					New subscribers get this email and only join once they click its button, so fake and mistyped
					addresses never reach the list. It&apos;s the only email they get: say what comes next.
				</p>
				{isConfirmationRequired && (
					<>
						<Field label="Subject">
							<Input
								name="confirmationSubject"
								value={confirmation.subject}
								required
								onChange={updateConfirmation("subject")}
							/>
						</Field>
						<Field label="Preview text">
							<Input
								name="confirmationPreviewText"
								value={confirmation.previewText}
								placeholder="Optional"
								onChange={updateConfirmation("previewText")}
							/>
						</Field>
						<Field
							label="Content"
							hint={`Markdown. Keep the button: its ${CONFIRM_URL_PLACEHOLDER} becomes each subscriber's link.`}
						>
							<Textarea
								name="confirmationMarkdown"
								value={confirmation.markdown}
								onChange={updateConfirmation("markdown")}
								className="min-h-48 font-mono text-[13px] leading-6"
							/>
						</Field>
						<div className="p-3">
							<PreviewEmail
								html={confirmationHtml}
								sender={{ name, fromName, fromEmail, imageUrl: previewImageUrl }}
								subject={deferredConfirmation.subject}
								previewText={deferredConfirmation.previewText}
								fit="content"
							/>
						</div>
					</>
				)}
			</Section>

			<Section
				title="Welcome email"
				stagger={3}
				collapsedNote={
					isConfirmationRequired &&
					"Not sent while new signups confirm, since the confirmation email replaces it. Its content is kept."
				}
				action={
					<Switch
						name="welcomeEnabled"
						checked={isWelcomeEnabled}
						onCheckedChange={switchWelcome}
						aria-label="Welcome email"
					/>
				}
			>
				{welcomePause && isWelcomeEnabled && <NoticeWelcomePaused {...welcomePause} className="px-4 py-3" />}
				<Field label="Subject">
					<Input name="welcomeSubject" value={welcome.subject} onChange={updateWelcome("subject")} />
				</Field>
				<Field label="Preview text">
					<Input
						name="welcomePreviewText"
						value={welcome.previewText}
						placeholder="Optional"
						onChange={updateWelcome("previewText")}
					/>
				</Field>
				<Field label="Content" hint="Markdown">
					<Textarea
						name="welcomeMarkdown"
						value={welcome.markdown}
						onChange={updateWelcome("markdown")}
						className="min-h-48 font-mono text-[13px] leading-6"
					/>
				</Field>
				{deferredWelcome.markdown.trim() && (
					<div className="p-3">
						<PreviewEmail
							html={welcomeHtml}
							sender={{ name, fromName, fromEmail, imageUrl: previewImageUrl }}
							subject={deferredWelcome.subject}
							previewText={deferredWelcome.previewText}
							fit="content"
						/>
					</div>
				)}
				{newsletter && (
					<div className="flex items-center justify-between gap-3 px-4 py-3">
						<p className="text-xs wrap-anywhere text-muted-foreground">
							{isSendingEnabled || !hasPlan ? `Sends the saved version to ${testEmail}` : "Sending is off"}
						</p>
						<Button type="button" variant="outline" size="sm" onClick={sendTest} disabled={(hasPlan && !isSendingEnabled) || isTesting}>
							{isTesting ? <Loader2 className="animate-spin" /> : <FlaskConical />}
							Send test
						</Button>
					</div>
				)}
			</Section>

			<Section
				title="List cleanup"
				stagger={4}
				action={
					<Switch
						name="cleanupEnabled"
						checked={isCleanupEnabled}
						onCheckedChange={(isChecked) => set("isCleanupEnabled", isChecked)}
						aria-label="List cleanup"
					/>
				}
			>
				<p className="px-4 py-3 text-sm text-pretty text-muted-foreground">
					Stops sending to contacts who stopped opening, unless they answer a last-chance email. Each time you send an
					issue, contacts who ignored the last {cleanup.issues || savedCleanup.issues} issues and showed no sign of life
					for {cleanup.days || savedCleanup.days} days get this email instead. A click
					on its button keeps them. Anyone who doesn&apos;t answer by a send{" "}
					{LAST_CHANCE_DAYS} days later becomes dormant: not unsubscribed, not deleted, and back if they sign up again.
				</p>
				<Field label="Ignored issues" hint="In a row, counting from the first issue MailCheap sent">
					<Input
						name="cleanupIssues"
						type="number"
						inputMode="numeric"
						min={CLEANUP_LIMITS.minIssues}
						max={CLEANUP_LIMITS.maxIssues}
						value={cleanup.issues}
						onChange={updateCleanup("issues")}
						className="w-28 tabular-nums"
					/>
				</Field>
				<Field label="Quiet for" hint="Days since the last open, click or signup">
					<span className="flex items-center gap-2">
						<Input
							name="cleanupDays"
							type="number"
							inputMode="numeric"
							min={CLEANUP_LIMITS.minDays}
							max={CLEANUP_LIMITS.maxDays}
							value={cleanup.days}
							onChange={updateCleanup("days")}
							className="w-28 tabular-nums"
						/>
						<span className="text-sm text-muted-foreground">days</span>
					</span>
				</Field>
				{cleanupTotals && <CleanupTotals totals={cleanupTotals} />}
				{isCleanupEnabled && (
					<div className="p-3">
						<PreviewEmail
							html={lastChance.html}
							sender={{ name, fromName, fromEmail, imageUrl: previewImageUrl }}
							subject={lastChance.subject}
							previewText={lastChance.previewText}
							fit="content"
						/>
					</div>
				)}
			</Section>

			<Section
				title="Public archive"
				stagger={5}
				action={
					<div className="flex items-center gap-3">
						{newsletter?.archiveEnabled && (
							<a
								href={`/archive/${newsletter.slug}`}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
							>
								View
								<ExternalLink className="size-3" />
							</a>
						)}
						<Switch
							name="archiveEnabled"
							checked={isArchiveEnabled}
							onCheckedChange={(isChecked) => set("isArchiveEnabled", isChecked)}
							aria-label="Public archive"
						/>
					</div>
				}
			>
				<p className="px-4 py-3 text-sm text-pretty wrap-anywhere text-muted-foreground">
					Sent issues get a page with a signup form, at {archiveAddress}.
					{!archiveHost && " Add a domain on the Domains page to serve it on your own subdomain."}
				</p>
				<Field label="Description" hint="One sentence under the name and in the subscribe popup">
					<Textarea
						name="description"
						value={description}
						rows={2}
						maxLength={MAX_DESCRIPTION_LENGTH}
						placeholder="One idea about building things, every Sunday."
						onChange={update("description")}
					/>
				</Field>
				<Field label="Author bio" hint="Under your name on the author page">
					<Input
						name="authorBio"
						value={draft.authorBio}
						maxLength={MAX_AUTHOR_BIO_LENGTH}
						placeholder="I write about building small software companies."
						onChange={update("authorBio")}
					/>
				</Field>
				<Field label="Author photo" hint="Square photo on the author page. The newsletter image otherwise.">
					<InputImage
						key={discardCount}
						name="authorImageUrl"
						defaultValue={draft.authorImageUrl}
						label="author photo"
						onChange={(value) => set("authorImageUrl", value)}
					/>
				</Field>
				<Field label="Social links" hint="One link per line">
					<Textarea
						name="socialLinks"
						value={draft.socialLinks}
						rows={3}
						placeholder={"https://x.com/example\nhttps://youtube.com/@example"}
						className="font-mono text-[13px] leading-6"
						onChange={update("socialLinks")}
					/>
				</Field>
			</Section>

			<BarSave isDirty={isDirty} isSaving={isSaving} savedAt={savedAt} onDiscard={discard} label={newsletter ? "Save" : "Create"} />
		</form>
	);
}

// With a collapsedNote, the note stands in for the action and the fields, which aren't sent with the form.
function Section({ title, action, stagger, collapsedNote, children }) {
	return (
		<section style={{ "--stagger": stagger }} className="rounded-xl bg-card shadow-border animate-enter">
			<div className="flex h-12 items-center justify-between gap-3 px-4">
				<h2 className="text-sm font-medium">{title}</h2>
				{!collapsedNote && action}
			</div>
			{collapsedNote ? (
				<p className="border-t border-border/60 px-4 py-3 text-sm text-pretty text-muted-foreground">
					{collapsedNote}
				</p>
			) : (
				children && <div className="divide-y divide-border/60 border-t border-border/60">{children}</div>
			)}
		</section>
	);
}

function CleanupTotals({ totals }) {
	const stats = [
		{ label: "Waiting for an answer", value: totals.waiting },
		{ label: "Kept after the email", value: totals.kept },
		{ label: "Made dormant", value: totals.dormant },
	];
	return (
		<dl className="grid grid-cols-3 divide-x divide-border/60">
			{stats.map(({ label, value }) => (
				<div key={label} className="flex flex-col gap-1 px-4 py-3">
					<dt className="text-xs text-pretty text-muted-foreground">{label}</dt>
					<dd className="text-lg font-semibold tabular-nums">{formatNumber(value)}</dd>
				</div>
			))}
		</dl>
	);
}

function getFromHint({ isShared, isDomainUnverified, fromDomain, hasDomains }) {
	if (isShared) return "The shared address follows the slug and needs no setup. Replies go to the reply-to, or to your account email.";
	if (isDomainUnverified) return `${fromDomain} isn't verified yet. Emails wait until its DNS records are in.`;
	if (!fromDomain && !hasDomains) return "Add a domain on the Domains page to send from it";
	return null;
}

function Field({ label, hint, isWarning, children }) {
	return (
		<label className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
			<span className="text-sm text-muted-foreground sm:pt-2">{label}</span>
			<span className="flex min-w-0 flex-col gap-1.5">
				{children}
				{hint && (
					<span
						className={cn(
							"text-xs",
							isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
						)}
					>
						{hint}
					</span>
				)}
			</span>
		</label>
	);
}
