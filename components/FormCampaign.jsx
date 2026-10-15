"use client";

import { useCallback, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { Check, CircleAlert, Copy, Eye, FlaskConical, ListChecksIcon, Loader2, MoreHorizontal, Trash2, X } from "lucide-react";
import { duplicateCampaign, saveCampaign, sendTestCampaign } from "@/app/(app)/campaigns/actions";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import BadgeStatus from "@/components/BadgeStatus";
import DialogDiscardCampaign from "@/components/DialogDiscardCampaign";
import DialogScheduleCampaign from "@/components/DialogScheduleCampaign";
import DialogSendCampaign from "@/components/DialogSendCampaign";
import EditorRich from "@/components/EditorRich";
import GatePlan from "@/components/GatePlan";
import HeaderPage from "@/components/HeaderPage";
import InputCampaignSlug from "@/components/InputCampaignSlug";
import ListChecks from "@/components/ListChecks";
import PreviewEmail from "@/components/PreviewEmail";
import ScriptInline from "@/components/ScriptInline";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	EDITOR_PANELS,
	readPanel,
	readPreviewDevice,
	restorePanels,
	storePanel,
	storePreviewDevice,
} from "@/lib/editor-panels";
import { formatNumber } from "@/lib/format";
import { markdownToHtml } from "@/lib/markdown";
import { getPresendChecks } from "@/lib/presend-checks";
import { UNSUBSCRIBE_PLACEHOLDER, renderEmail, withResponsiveImages } from "@/lib/render-email";
import { slugify } from "@/lib/slug";
import { toast } from "@/lib/toast";
import { usePaywall } from "@/lib/use-paywall";
import { useToastError } from "@/lib/use-toast-error";
import { useAutosave } from "@/lib/use-autosave";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";

const UPLOADING_MESSAGE = "Wait for images to finish uploading";

export default function FormCampaign({
	campaign,
	newsletter,
	audienceCount,
	senderProblem,
	isSendingEnabled,
	testEmail,
	sendTimes,
	archiveUrlBase,
	planProblem,
	emailsLeft,
	warmup,
	newContacts,
}) {
	const isHtml = campaign.format === "html";
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);
	const format = isHtml ? "html" : "rich";
	const [initialBody] = useState(() =>
		campaign.format === "markdown" ? markdownToHtml(campaign.markdown) : campaign.html
	);
	const [values, setValues] = useState({
		subject: campaign.subject,
		previewText: campaign.previewText,
		body: initialBody,
	});
	const save = useCallback((snapshot) => saveCampaign(campaign._id, { ...snapshot, format }), [campaign._id, format]);
	const { isDirty, isSaving, error, flush } = useAutosave(values, save);
	const [isTesting, startTesting] = useTransition();
	const [isWorking, startWorking] = useTransition();
	const toastError = useToastError();
	const paywall = usePaywall();
	const hasPlan = paywall?.hasPlan ?? true;
	const deferredValues = useDeferredValue(values);
	const isUploading = values.body.includes('src="blob:');
	const isClient = useIsClient();
	const [isChecklistOpen, setIsChecklistOpen] = useState(() => readPanel(EDITOR_PANELS.checklist));
	const [isPreviewDocked, setIsPreviewDocked] = useState(() => readPanel(EDITOR_PANELS.preview));
	const [isPreviewSheetOpen, setIsPreviewSheetOpen] = useState(false);
	const [isDockMounted, setIsDockMounted] = useState(isPreviewDocked);
	const rootRef = useRef(null);
	const dockRef = useRef(null);
	const previewToggleRef = useRef(null);

	if (isPreviewDocked && !isDockMounted) setIsDockMounted(true);

	const rendered = useMemo(
		() =>
			renderEmail({
				format,
				html: deferredValues.body,
				subject: deferredValues.subject,
				previewText: deferredValues.previewText,
				newsletter,
			}),
		[format, deferredValues, newsletter]
	);
	const previewHtml = useMemo(
		() => withResponsiveImages(rendered.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#")),
		[rendered.html]
	);
	const { checks, blocking } = getPresendChecks({
		campaign: { ...campaign, ...values },
		newsletter,
		rendered,
		senderProblem,
		isSendingEnabled,
		planProblem,
	});
	const problemCount = checks.filter(({ isOk }) => !isOk).length;
	// Without a plan, Send and Schedule open the paywall first; the checks wait until there's one.
	const blockingMessage = !hasPlan ? null : isUploading ? UPLOADING_MESSAGE : blocking[0]?.message;

	async function persist() {
		if (await flush()) return true;
		toast.error("Couldn't save the draft");
		return false;
	}

	function sendTest() {
		if (!hasPlan) return paywall.open("test");
		startTesting(async () => {
			if (isUploading) return void toast.error(UPLOADING_MESSAGE);
			if (!(await persist())) return;
			const result = await sendTestCampaign(campaign._id);
			if (result?.error) toastError(result);
			else toast.success(`Test sent to ${testEmail}`);
		});
	}

	function runAction(action) {
		startWorking(async () => {
			const result = await action(campaign._id);
			if (result?.error) toast.error(result.error);
		});
	}

	function toggleChecklist() {
		storePanel(EDITOR_PANELS.checklist, !isChecklistOpen);
		setIsChecklistOpen(!isChecklistOpen);
	}

	function togglePreview() {
		if (!window.matchMedia(EDITOR_PANELS.preview.media).matches) return setIsPreviewSheetOpen(true);
		storePanel(EDITOR_PANELS.preview, !isPreviewDocked);
		setIsPreviewDocked(!isPreviewDocked);
	}

	function closePreview() {
		if (dockRef.current?.contains(document.activeElement)) previewToggleRef.current?.focus();
		storePanel(EDITOR_PANELS.preview, false);
		setIsPreviewDocked(false);
	}

	const onKeyDown = useEffectEvent((event) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
			event.preventDefault();
			flush();
		}
		// Menus and dialogs take Escape first. ProseMirror marks every Escape in the editor as taken, so there only the
		// slash menu keeps it, by stopping it. Fields outside the page, like the link one over a selection, keep theirs.
		const isTaken = event.defaultPrevented && !event.target.closest?.(".ProseMirror");
		const isOnPage = event.target === document.body || rootRef.current?.contains(event.target);
		if (event.key === "Escape" && isPreviewDocked && !isTaken && isOnPage) closePreview();
	});
	const onBeforeUnload = useEffectEvent((event) => {
		if (!isDirty && !isSaving) return;
		flush();
		event.preventDefault();
	});

	useEffect(() => {
		function handleKeyDown(event) {
			onKeyDown(event);
		}
		function handleBeforeUnload(event) {
			onBeforeUnload(event);
		}
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, []);

	// Crossing the width where the preview docks: the dock follows what was picked there, the sheet closes.
	useEffect(() => {
		const media = window.matchMedia(EDITOR_PANELS.preview.media);
		function handleChange() {
			setIsPreviewDocked(readPanel(EDITOR_PANELS.preview));
			setIsPreviewSheetOpen(false);
		}
		media.addEventListener("change", handleChange);
		return () => media.removeEventListener("change", handleChange);
	}, []);

	// The preview stays in the dock while it slides out.
	useEffect(() => {
		if (isPreviewDocked || !isDockMounted) return;
		const timeout = setTimeout(() => setIsDockMounted(false), DOCK_EXIT_MS);
		return () => clearTimeout(timeout);
	}, [isPreviewDocked, isDockMounted]);

	function update(key) {
		return (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
	}

	const updateBody = useCallback((body) => setValues((current) => ({ ...current, body })), []);

	const from = newsletter.fromName
		? `${newsletter.fromName} <${newsletter.fromEmail}>`
		: newsletter.fromEmail;

	const preview = {
		sender: newsletter,
		subject: deferredValues.subject,
		previewText: deferredValues.previewText,
		html: previewHtml,
		bytes: rendered.bytes,
	};

	return (
		<div
			ref={rootRef}
			data-wide-page
			data-checklist={isChecklistOpen ? "" : undefined}
			data-preview={isPreviewDocked ? "" : undefined}
			className="group/editor"
		>
			<HeaderPage
				title={values.subject || "Untitled"}
				backHref="/campaigns"
				icon={<AvatarNewsletter newsletter={newsletter} size={28} />}
				meta={<BadgeStatus status={campaign.status} />}
			>
				<StatusSave isSaving={isDirty || isSaving} error={error} onRetry={flush} />
				<TogglePanel
					name="checklist"
					label="Checklist"
					icon={ListChecksIcon}
					isOpen={isChecklistOpen}
					onToggle={toggleChecklist}
				>
					<BadgeChecks count={problemCount} isBlocking={blocking.length > 0} />
				</TogglePanel>
				<TogglePanel
					ref={previewToggleRef}
					name="preview"
					label="Preview"
					icon={Eye}
					isOpen={isPreviewDocked || isPreviewSheetOpen}
					onToggle={togglePreview}
				/>
				<Tooltip>
					<TooltipTrigger asChild>
						<span tabIndex={isSendingEnabled || !hasPlan ? -1 : 0} className="rounded-lg">
							<Button variant="outline" onClick={sendTest} disabled={(hasPlan && !isSendingEnabled) || isTesting}>
								{isTesting ? (
									<Loader2 data-icon="inline-start" className="animate-spin" />
								) : (
									<FlaskConical data-icon="inline-start" />
								)}
								Test
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent>{isSendingEnabled || !hasPlan ? `Sends to ${testEmail}` : "Sending is off"}</TooltipContent>
				</Tooltip>
				<GatePlan reason="schedule">
					<DialogScheduleCampaign
						campaignId={campaign._id}
						scheduledAt={campaign.status === "scheduled" ? campaign.scheduledAt : null}
						audienceLimit={campaign.audienceLimit}
						audienceCount={audienceCount}
						history={sendTimes.history}
						taken={sendTimes.taken}
						isCleanupEnabled={Boolean(newsletter.cleanup?.enabled)}
						warmup={warmup}
						newContacts={newContacts}
						blockingMessage={blockingMessage}
						onBeforeSchedule={persist}
					/>
				</GatePlan>
				<GatePlan reason="send">
					<DialogSendCampaign
						campaignId={campaign._id}
						audienceCount={audienceCount}
						emailsLeft={emailsLeft}
						scheduledAt={campaign.status === "scheduled" ? campaign.scheduledAt : null}
						isCleanupEnabled={Boolean(newsletter.cleanup?.enabled)}
						warmup={warmup}
						newContacts={newContacts}
						blockingMessage={blockingMessage}
						onBeforeSend={persist}
					/>
				</GatePlan>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" aria-label="More" disabled={isWorking}>
							<MoreHorizontal />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onSelect={() => runAction(duplicateCampaign)}>
							<Copy />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onSelect={() => setIsDiscardOpen(true)}>
							<Trash2 />
							Discard
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<DialogDiscardCampaign
					id={campaign._id}
					subject={values.subject}
					scheduledAt={campaign.status === "scheduled" ? campaign.scheduledAt : null}
					isOpen={isDiscardOpen}
					onOpenChange={setIsDiscardOpen}
					redirectTo="/campaigns"
				/>
			</HeaderPage>

			<div
				className={cn(
					"grid min-[90rem]:grid-cols-[minmax(0,1fr)_0rem] min-[90rem]:motion-safe:transition-[grid-template-columns,column-gap] min-[90rem]:group-data-[preview]/editor:grid-cols-[minmax(0,1fr)_42.5rem] min-[90rem]:group-data-[preview]/editor:gap-x-4 min-[90rem]:group-data-[preview]/editor:duration-300",
					PANEL_MOTION
				)}
			>
				<div className="mx-auto w-full max-w-2xl min-w-0 animate-enter">
					<div
						className={cn(
							"invisible grid grid-rows-[0fr] opacity-0 transition-[opacity,visibility] motion-safe:transition-[grid-template-rows,opacity,visibility] group-data-[checklist]/editor:visible group-data-[checklist]/editor:grid-rows-[1fr] group-data-[checklist]/editor:opacity-100 group-data-[checklist]/editor:duration-300",
							PANEL_MOTION
						)}
					>
						{/* Clipped while it unfolds; the padding keeps the card's ring and shadow inside the clip. */}
						<div className="-mx-1 min-h-0 overflow-hidden">
							<div className="px-1 pt-px pb-4">
								<ListChecks checks={checks} />
							</div>
						</div>
					</div>
					<div className="overflow-hidden rounded-xl bg-card shadow-border">
						<Row label="From">
							<span className="truncate text-sm">{from}</span>
						</Row>
						<Row label="To">
							<span className="flex min-w-0 items-center gap-2 text-sm">
								<AvatarNewsletter newsletter={newsletter} size={18} />
								<span className="truncate">
									{newsletter.name}
									<span className="text-muted-foreground tabular-nums">
										{" "}
										· {formatNumber(audienceCount)}
									</span>
								</span>
							</span>
						</Row>
						<Row label="Subject">
							<input
								value={values.subject}
								onChange={update("subject")}
								placeholder="Subject"
								maxLength={200}
								className="h-11 w-full min-w-0 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
							/>
						</Row>
						<Row label="Preview">
							<input
								value={values.previewText}
								onChange={update("previewText")}
								placeholder="Text shown after the subject"
								maxLength={300}
								className="h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							/>
						</Row>
						{archiveUrlBase && (
							<Row label="URL">
								<InputCampaignSlug
									campaignId={campaign._id}
									initialSlug={campaign.archiveSlug ?? ""}
									placeholder={slugify(values.subject, 80) || "issue"}
									urlBase={archiveUrlBase}
								/>
							</Row>
						)}
						{isHtml ? (
							<div className="relative">
								<span className="pointer-events-none absolute top-3 right-4 text-xs text-muted-foreground">HTML</span>
								<textarea
									value={values.body}
									onChange={update("body")}
									placeholder="<html>"
									spellCheck={false}
									aria-label="Content"
									className="block min-h-[560px] w-full resize-none bg-transparent px-4 py-4 font-mono text-[13px] leading-6 outline-none [field-sizing:content] placeholder:text-muted-foreground"
								/>
							</div>
						) : (
							<EditorRich content={initialBody} onChange={updateBody} />
						)}
					</div>
				</div>

				{/* Clipped across, so the preview slides in from the right as its column opens. */}
				<div className="-mr-1 hidden overflow-x-clip pr-1 min-[90rem]:block">
					<aside
						ref={dockRef}
						aria-label="Preview"
						style={{ "--stagger": 1 }}
						className={cn(
							"invisible sticky top-[calc(var(--plan-bar-height)+1.5rem)] h-[calc(100dvh-var(--plan-bar-height)-3rem)] w-[42.5rem] opacity-0 transition-[opacity,visibility] animate-enter group-data-[preview]/editor:visible group-data-[preview]/editor:opacity-100 group-data-[preview]/editor:duration-300",
							PANEL_MOTION
						)}
					>
						{isClient && isDockMounted ? (
							<PanelPreview {...preview} onClose={closePreview} className="h-full" />
						) : (
							<SkeletonPreview />
						)}
					</aside>
				</div>
			</div>

			<Sheet open={isPreviewSheetOpen} onOpenChange={setIsPreviewSheetOpen}>
				<SheetContent
					side="right"
					showCloseButton={false}
					aria-describedby={undefined}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						previewToggleRef.current?.focus();
					}}
					className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[42.5rem]"
				>
					<SheetTitle className="sr-only">Preview</SheetTitle>
					<PanelPreview
						{...preview}
						onClose={() => setIsPreviewSheetOpen(false)}
						className="h-full rounded-none shadow-none"
					/>
				</SheetContent>
			</Sheet>
			<ScriptInline html={`(${restorePanels})(${JSON.stringify(EDITOR_PANELS)})`} />
		</div>
	);
}

// restorePanels finds these by data-toggle.
function TogglePanel({ ref, name, label, icon: Icon, isOpen, onToggle, children }) {
	return (
		<Button
			ref={ref}
			variant="ghost"
			data-toggle={name}
			aria-pressed={isOpen}
			onClick={onToggle}
			className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground dark:aria-pressed:bg-muted"
		>
			<Icon data-icon="inline-start" />
			{label}
			{children}
		</Button>
	);
}

// How many checks need a look, solid while one of them blocks sending; a check mark once none do.
function BadgeChecks({ count, isBlocking }) {
	return (
		<>
			<span
				aria-hidden
				className={cn(
					"grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] leading-none font-semibold tabular-nums",
					count === 0
						? "text-muted-foreground"
						: isBlocking
							? "bg-foreground text-background"
							: "bg-foreground/10 text-foreground"
				)}
			>
				{count === 0 ? <Check className="size-3.5" /> : count}
			</span>
			{count > 0 && <span className="sr-only">, {count} to check</span>}
		</>
	);
}

function PanelPreview({ bytes, onClose, ...props }) {
	return (
		<PreviewEmail
			{...props}
			defaultDevice={readPreviewDevice()}
			onDeviceChange={storePreviewDevice}
			toolbar={<ToolbarPreview bytes={bytes} onClose={onClose} />}
		/>
	);
}

function ToolbarPreview({ bytes, onClose }) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-xs text-muted-foreground tabular-nums">{Math.ceil(bytes / 1000)} KB</span>
			<Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close preview" className="-mr-1.5 text-muted-foreground">
				<X />
			</Button>
		</div>
	);
}

// The dock's frame until the preview renders in the browser: a reload paints it before React hydrates.
function SkeletonPreview() {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded-xl bg-card shadow-border">
			<div className="h-11 shrink-0 border-b border-border/60" />
			<div className="h-[65px] shrink-0 border-b border-border/60" />
			<div className="flex-1 bg-muted/50" />
		</div>
	);
}

function StatusSave({ isSaving, error, onRetry }) {
	if (error) {
		return (
			<button
				type="button"
				onClick={onRetry}
				title={error}
				className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
			>
				<CircleAlert className="size-3.5" />
				Not saved, retry
			</button>
		);
	}
	return (
		<span aria-live="polite" className="flex min-w-16 items-center justify-end gap-1.5 text-xs text-muted-foreground">
			{isSaving ? (
				"Saving…"
			) : (
				<>
					<Check className="size-3.5" />
					Saved
				</>
			)}
		</span>
	);
}

function Row({ label, children }) {
	return (
		<div className="grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)] items-center border-b border-border/60 px-4 transition-colors duration-150 focus-within:bg-muted/40">
			<span className="text-sm text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}

// Panels close in 200ms (and open in 300ms): DOCK_EXIT_MS keeps the dock's preview until it's out of sight.
const PANEL_MOTION = "duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]";
const DOCK_EXIT_MS = 200;
