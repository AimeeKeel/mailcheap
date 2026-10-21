"use client";

import {
	useCallback,
	useDeferredValue,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
	ArrowRight,
	CalendarClock,
	ChevronLeft,
	CircleAlert,
	CircleX,
	Copy,
	Eye,
	FlaskConical,
	Globe,
	Loader2,
	MoreHorizontal,
	Send,
	Trash2,
	UserRound,
} from "lucide-react";
import { duplicateCampaign, saveCampaign, sendTestCampaign, setCampaignPublishTo } from "@/app/(app)/campaigns/actions";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import BadgeStatus from "@/components/BadgeStatus";
import CardSettings from "@/components/CardSettings";
import DialogDiscardCampaign from "@/components/DialogDiscardCampaign";
import DialogPreviewEmail from "@/components/DialogPreviewEmail";
import EditorRich from "@/components/EditorRich";
import ListChecks from "@/components/ListChecks";
import NavSteps from "@/components/NavSteps";
import PanelSend from "@/components/PanelSend";
import StatusSaved from "@/components/StatusSaved";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { getCheckFix } from "@/lib/campaign-steps";
import { markdownToHtml } from "@/lib/markdown";
import { fillSampleName, firstNameTag } from "@/lib/merge-tags";
import { getPresendChecks } from "@/lib/presend-checks";
import { readPublishTo } from "@/lib/publish-to";
import { UNSUBSCRIBE_PLACEHOLDER, renderEmail, withResponsiveImages } from "@/lib/render-email";
import { SEGMENT_DELETED } from "@/lib/segments";
import { toast } from "@/lib/toast";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePaywall } from "@/lib/use-paywall";
import { useSendCampaign } from "@/lib/use-send-campaign";
import { useToastError } from "@/lib/use-toast-error";
import { useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";

const UPLOADING_MESSAGE = "Wait for images to finish uploading";
const SUBJECT_MAX = 200;
// Below lg, as the step bar's classes.
const COMPACT_SCREEN = "(width < 64rem)";
// Preview and Next share a height in every step (the mobile save bar is 3rem, so 2.25rem inside it).
const STEP_BUTTON = "h-9 lg:h-8";

export default function FormCampaign({
	campaign,
	newsletter,
	audienceCount,
	everyoneCount,
	segments,
	isSegmentDeleted,
	senderProblem,
	isSharedSender = false,
	domainNudge = null,
	isSendingEnabled,
	testEmail,
	sendTimes,
	archiveUrlBase,
	planProblem,
	emailsLeft,
	pace,
	newContacts,
}) {
	const isHtml = campaign.format === "html";
	const [step, setStep] = useState("write");
	const [isCalm, setIsCalm] = useState(false);
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);
	const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
	const { isDirty, isSaving, savedAt, error, flush } = useAutosave(values, save);
	const [isTesting, startTesting] = useTransition();
	const [isWorking, startWorking] = useTransition();
	const [publishTo, setPublishTo] = useState(() => readPublishTo(campaign));
	const [isChangingPublishTo, startChangingPublishTo] = useTransition();
	const isWebOnly = publishTo === "web";
	const toastError = useToastError();
	const paywall = usePaywall();
	const hasPlan = paywall?.hasPlan ?? true;
	const deferredValues = useDeferredValue(values);
	const isUploading = values.body.includes('src="blob:');
	const scheduledAt = campaign.status === "scheduled" ? campaign.scheduledAt : null;
	const isCompact = useMediaQuery(COMPACT_SCREEN);
	const rootRef = useRef(null);
	const subjectRef = useRef(null);
	const previewTextRef = useRef(null);
	const previewOpenerRef = useRef(null);
	const scrollsRef = useRef({});
	useFitHeight(subjectRef, values.subject);
	useFitHeight(previewTextRef, values.previewText);

	async function persist() {
		if (await flush()) return true;
		toast.error("Couldn't save the draft");
		return false;
	}

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
		() => withResponsiveImages(fillSampleName(rendered.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#"), { isHtml: true })),
		[rendered.html]
	);
	const { checks } = getPresendChecks({
		campaign: { ...campaign, ...values, publishTo },
		newsletter,
		rendered,
		senderProblem,
		isSharedSender,
		isSendingEnabled,
		planProblem,
	});
	const reviewChecks = checks.map((check) => ({ ...check, fix: getCheckFix(check, { newsletterId: newsletter._id }) }));
	// Without a plan, Send and Schedule open the paywall first, and the checks wait until there's one.
	const accountProblems = hasPlan ? reviewChecks.filter(({ isAccount, isOk }) => isAccount && !isOk) : [];
	const blocking = [
		...(isUploading ? [{ id: "uploading", message: UPLOADING_MESSAGE }] : []),
		...(isSegmentDeleted && !isWebOnly ? [{ id: "segment", message: SEGMENT_DELETED }] : []),
		...reviewChecks.filter(({ isOk, isWarning }) => !isOk && !isWarning),
	];
	const sending = useSendCampaign({
		campaignId: campaign._id,
		audienceCount,
		audienceLimit: campaign.audienceLimit,
		emailsLeft,
		scheduledAt,
		isCleanupEnabled: Boolean(newsletter.cleanup?.enabled),
		sendTimes,
		blocking,
		hasPlan,
		isWebOnly,
		onBeforeSend: persist,
	});
	const isTestDisabled = hasPlan && !isSendingEnabled;

	// Saved right away, like the segment: the send step and the checks follow it.
	function changePublishTo(next) {
		const previous = publishTo;
		if (next === previous) return;
		setPublishTo(next);
		startChangingPublishTo(async () => {
			const result = await setCampaignPublishTo(campaign._id, next);
			if (result?.error) {
				setPublishTo(previous);
				return void toast.error(result.error);
			}
			if (previous === "web") sending.prepare();
		});
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

	// Each step keeps its own scroll, so going back to the draft lands where the writing was.
	function goToStep(next) {
		if (next === step) return;
		scrollsRef.current[step] = window.scrollY;
		if (next === "send") sending.prepare();
		flushSync(() => {
			setStep(next);
			setIsCalm(false);
		});
		window.scrollTo({ top: scrollsRef.current[next] ?? 0 });
	}

	function getContent() {
		return rootRef.current?.querySelector('[aria-label="Content"]');
	}

	function editField(field) {
		goToStep("write");
		const target = field === "subject" ? subjectRef.current : field === "previewText" ? previewTextRef.current : getContent();
		target?.focus({ preventScroll: true });
		target?.scrollIntoView({ block: "center" });
	}

	function endCalm() {
		setIsCalm(false);
	}

	// Typing in the draft dims the top bar; moving the pointer, or the keyboard reaching the bar, brings it back.
	function startCalm(event) {
		if (isCalm || event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter") setIsCalm(true);
	}

	useEffect(() => {
		if (!isCalm) return;
		let start = null;
		function handlePointerMove(event) {
			start ??= { x: event.clientX, y: event.clientY };
			if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) endCalm();
		}
		window.addEventListener("pointermove", handlePointerMove);
		return () => window.removeEventListener("pointermove", handlePointerMove);
	}, [isCalm]);

	// opener: what gets the focus back once the preview closes.
	function openPreview(opener) {
		previewOpenerRef.current = opener;
		setIsPreviewOpen(true);
	}

	const onKeyDown = useEffectEvent((event) => {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
			event.preventDefault();
			flush();
		}
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

	function update(key) {
		return (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
	}

	// The subject and the preview text wrap like a title, but stay one line: a pasted line break becomes a space.
	function updateLine(key) {
		return (event) => setValues((current) => ({ ...current, [key]: event.target.value.replace(/\s*[\r\n]+\s*/g, " ") }));
	}

	function onSubjectEnter(event) {
		if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
		event.preventDefault();
		previewTextRef.current?.focus();
	}

	function onPreviewEnter(event) {
		if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
		event.preventDefault();
		getContent()?.focus();
	}

	// {{first_name|there}} where the cursor is in the subject, or at its end (lib/merge-tags.js). The button keeps the
	// focus in the subject, so its cursor is still there.
	function insertFirstName() {
		const input = subjectRef.current;
		const tag = firstNameTag();
		const isTyping = document.activeElement === input;
		const start = isTyping ? input.selectionStart : input.value.length;
		const end = isTyping ? input.selectionEnd : start;
		const subject = `${input.value.slice(0, start)}${tag}${input.value.slice(end)}`.slice(0, SUBJECT_MAX);
		setValues((current) => ({ ...current, subject }));
		requestAnimationFrame(() => {
			input.focus();
			input.setSelectionRange(start + tag.length, start + tag.length);
		});
	}

	const updateBody = useCallback((body) => setValues((current) => ({ ...current, body })), []);

	const sendAction =
		sending.choice === "now"
			? {
					label: isWebOnly ? "Publish now" : "Send now",
					icon: isWebOnly ? Globe : Send,
					reason: "send",
					title: isWebOnly ? "Before you publish" : "Before you send",
					run: () => sending.setIsConfirmOpen(true),
				}
			: { label: "Schedule", icon: CalendarClock, reason: "schedule", title: "Before you schedule", run: sending.schedule };
	const action = {
		write: { label: "Next: review", icon: ArrowRight, isIconAfter: true, onClick: () => goToStep("review") },
		review: { label: "Next: send", icon: ArrowRight, isIconAfter: true, onClick: () => goToStep("send") },
		send: {
			label: sendAction.label,
			icon: sendAction.icon,
			onClick: () => (hasPlan ? sendAction.run() : paywall.open(sendAction.reason)),
			problems: sending.problems,
			problemsTitle: sendAction.title,
			isPending: sending.isPending,
		},
	}[step];

	// Saved shows for a moment after each save, first in every step so a step change doesn't replay it. Preview sits next
	// to the step's button in every step, as tall as it.
	function renderStatus() {
		return (
			<>
				{error ? <ButtonRetrySave error={error} onRetry={flush} /> : <StatusSaved savedAt={savedAt} />}
				<Button
					variant="secondary"
					onClick={(event) => openPreview(event.currentTarget)}
					aria-label="Preview"
					className={cn(STEP_BUTTON, "max-sm:w-9 max-sm:px-0")}
				>
					<Eye data-icon="inline-start" />
					<span className="max-sm:sr-only">Preview</span>
				</Button>
			</>
		);
	}

	const title = <TitleCampaign title={values.subject} newsletter={newsletter} status={campaign.status} />;
	const menu = (
		<MenuMore
			isWorking={isWorking}
			isTesting={isTesting}
			isTestDisabled={isTestDisabled}
			onTest={sendTest}
			onPreview={openPreview}
			onDuplicate={() => runAction(duplicateCampaign)}
			onDiscard={() => setIsDiscardOpen(true)}
		/>
	);

	return (
		<div
			ref={rootRef}
			data-campaign-steps
			data-calm={isCalm ? "" : undefined}
			className="group/editor pb-(--step-bar-space) lg:pb-0"
		>
			{/* Phones and tablets: the title and the menu first, then the steps, which stick under the top bar. */}
			<div className="mb-4 flex items-center gap-2 animate-enter lg:hidden">
				{title}
				{menu}
			</div>
			<header
				onPointerEnter={endCalm}
				className="sticky top-[calc(var(--plan-bar-height)+3.5rem)] z-20 -mx-4 mb-6 border-b border-border/50 bg-background/70 px-4 py-2 backdrop-blur-md transition-opacity duration-200 ease-out focus-within:opacity-100 motion-reduce:opacity-100 motion-reduce:transition-none md:top-(--plan-bar-height) md:-mx-12 md:px-12 lg:-mt-10 lg:mb-0 lg:grid lg:h-14 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-10 lg:border-b-0 lg:bg-transparent lg:py-0 lg:backdrop-blur-none [@media(hover:hover)_and_(pointer:fine)]:group-data-[calm]/editor:opacity-40"
			>
				<div className="hidden min-w-0 lg:flex">{title}</div>
				<NavSteps step={step} onStep={goToStep} />
				<div className="hidden min-w-0 items-center justify-end gap-1.5 lg:flex">
					<BarAction action={action} status={renderStatus()} onEdit={editField} />
					{menu}
				</div>
			</header>

			<div className={cn("mx-auto w-full", step === "write" ? "max-w-3xl" : "max-w-2xl lg:mt-8")}>
				{step !== "write" && accountProblems.length > 0 && <NoticeAccountProblems problems={accountProblems} />}

				{/* The draft reads like a document: the subject as its title, the preview text under it, then the content,
				    all on one left edge (EditorRich keeps its drag grip in that margin). */}
				<section aria-label="Write" hidden={step !== "write"} onKeyDownCapture={startCalm} className="animate-enter">
					<div className="px-5 pt-4 lg:pt-12 [@media(pointer:fine)]:pl-12">
						<div className="relative">
							<textarea
								ref={subjectRef}
								rows={1}
								value={values.subject}
								onChange={updateLine("subject")}
								onKeyDown={onSubjectEnter}
								placeholder="Subject"
								aria-label="Subject"
								maxLength={SUBJECT_MAX}
								className="block w-full resize-none overflow-hidden bg-transparent pr-10 text-2xl leading-snug font-semibold tracking-tight outline-none [field-sizing:content] placeholder:text-muted-foreground/50 md:text-[1.75rem]"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								onMouseDown={(event) => event.preventDefault()}
								onClick={insertFirstName}
								aria-label="Insert first name"
								title="Insert first name"
								className="absolute top-0.5 right-0 text-muted-foreground/70 hover:text-foreground md:top-1"
							>
								<UserRound />
							</Button>
						</div>
						<textarea
							ref={previewTextRef}
							rows={1}
							value={values.previewText}
							onChange={updateLine("previewText")}
							onKeyDown={onPreviewEnter}
							placeholder="Preview text, shown after the subject in inboxes"
							aria-label="Preview text"
							maxLength={300}
							className="mt-2 block w-full resize-none overflow-hidden bg-transparent text-base leading-relaxed text-foreground/70 outline-none [field-sizing:content] placeholder:text-muted-foreground/50"
						/>
					</div>
					<div aria-hidden="true" className="mx-5 mt-6 h-px bg-border/50 [@media(pointer:fine)]:ml-12" />
					{isHtml ? (
						<div className="relative mx-5 mt-6 [@media(pointer:fine)]:ml-12">
							<span className="pointer-events-none absolute top-3 right-4 text-xs text-muted-foreground">HTML</span>
							<textarea
								value={values.body}
								onChange={update("body")}
								placeholder="<html>"
								spellCheck={false}
								aria-label="Content"
								className="block min-h-[560px] w-full resize-none bg-transparent py-4 font-mono text-[13px] leading-6 outline-none [field-sizing:content] placeholder:text-muted-foreground"
							/>
						</div>
					) : (
						<EditorRich content={initialBody} onChange={updateBody} />
					)}
				</section>

				<section aria-label="Review" hidden={step !== "review"} className="flex flex-col gap-6">
					<ListChecks
						checks={reviewChecks.filter(({ isAccount }) => !isAccount)}
						renderFix={({ fix }) =>
							fix && (
								<ButtonFix
									fix={fix}
									onEdit={editField}
									onTest={sendTest}
									isTesting={isTesting}
									isTestDisabled={isTestDisabled}
								/>
							)
						}
					/>
					<CardSettings title="Test and preview" stagger={1}>
						<ButtonRow
							icon={FlaskConical}
							title="Send a test email"
							description={isTestDisabled ? "Sending is off" : `Goes to ${testEmail}`}
							onClick={sendTest}
							isDisabled={isTestDisabled}
							isPending={isTesting}
						/>
						<ButtonRow
							icon={Eye}
							title="Preview"
							description="On desktop and mobile, at their real width"
							onClick={(event) => openPreview(event.currentTarget)}
						/>
					</CardSettings>
				</section>

				<section aria-label="Send" hidden={step !== "send"}>
					<PanelSend
						sending={sending}
						campaign={campaign}
						newsletter={newsletter}
						subject={values.subject}
						everyoneCount={everyoneCount}
						segments={segments}
						isSegmentDeleted={isSegmentDeleted}
						emailsLeft={emailsLeft}
						pace={pace}
						newContacts={newContacts}
						archiveUrlBase={archiveUrlBase}
						publishTo={publishTo}
						onPublishToChange={changePublishTo}
						isChangingPublishTo={isChangingPublishTo}
						websiteHref={getCheckFix({ id: "website" }, { newsletterId: newsletter._id })?.href}
						domainNudge={domainNudge}
					/>
				</section>
			</div>

			{/* Below lg the step's button floats at the bottom like a save bar, clear of the support chat's button, and the
			    get-started pill steps aside for it (app/globals.css). */}
			<div
				data-save-bar={isCompact ? "" : undefined}
				data-shown={isCompact ? "" : undefined}
				className="fixed right-(--dock-right) bottom-(--dock-bottom) left-4 z-30 flex h-12 items-center rounded-xl bg-card p-1.5 pl-4 shadow-float md:left-64 lg:hidden"
			>
				<BarAction action={action} status={renderStatus()} onEdit={editField} side="top" className="w-full" />
			</div>

			<DialogPreviewEmail
				isOpen={isPreviewOpen}
				onOpenChange={setIsPreviewOpen}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					previewOpenerRef.current?.focus();
				}}
				html={previewHtml}
				sender={newsletter}
				subject={fillSampleName(deferredValues.subject)}
				previewText={fillSampleName(deferredValues.previewText)}
			/>
			<DialogDiscardCampaign
				id={campaign._id}
				subject={values.subject}
				scheduledAt={scheduledAt}
				isOpen={isDiscardOpen}
				onOpenChange={setIsDiscardOpen}
				redirectTo="/campaigns"
			/>
		</div>
	);
}

// Above the review and send steps while the account can't send: the account's doing rather than the email's, so not
// in its checklist.
function NoticeAccountProblems({ problems }) {
	return (
		<div role="status" className="mb-6 flex flex-col gap-2 animate-enter">
			{problems.map(({ id, message, fix }) => (
				<div key={id} className="flex min-h-12 items-center gap-3 rounded-xl bg-red-500/10 py-2 pr-2 pl-4 text-sm">
					<CircleX aria-hidden="true" className="size-4 shrink-0 text-red-500" />
					<p className="min-w-0 flex-1 font-medium text-pretty">{message}</p>
					{fix?.href && (
						<Button asChild size="sm" variant="outline" className="bg-background">
							<Link href={fix.href}>{fix.label}</Link>
						</Button>
					)}
				</div>
			))}
		</div>
	);
}

function TitleCampaign({ title, newsletter, status }) {
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			<Link
				href="/campaigns"
				aria-label="Back"
				className="-ml-2 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground"
			>
				<ChevronLeft className="size-5" />
			</Link>
			<AvatarNewsletter newsletter={newsletter} size={20} />
			<h1 className="truncate text-base font-medium tracking-tight text-foreground/80 lg:text-sm">{title || "Untitled"}</h1>
			<BadgeStatus
				status={status}
				className="ml-1 h-auto gap-1 rounded-none bg-transparent p-0 text-[11px] font-normal text-muted-foreground/70 shadow-none"
			/>
		</div>
	);
}

// The test and the preview from any step. A dialog opened from here keeps the focus the menu would give back to its
// button as it closes; the preview hands it to that button once it closes, as the item that opened it is gone.
function MenuMore({ isWorking, isTesting, isTestDisabled, onTest, onPreview, onDuplicate, onDiscard }) {
	const triggerRef = useRef(null);
	const isOpeningDialogRef = useRef(false);

	function openDialog(open) {
		isOpeningDialogRef.current = true;
		open();
	}

	function keepDialogFocus(event) {
		if (!isOpeningDialogRef.current) return;
		isOpeningDialogRef.current = false;
		event.preventDefault();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					ref={triggerRef}
					variant="ghost"
					size="icon"
					aria-label="More"
					disabled={isWorking}
					className="text-muted-foreground lg:size-8"
				>
					<MoreHorizontal />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" onCloseAutoFocus={keepDialogFocus} className="w-52">
				<DropdownMenuItem onSelect={onTest} disabled={isTestDisabled || isTesting}>
					{isTesting ? <Loader2 className="animate-spin" /> : <FlaskConical />}
					Send a test email
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => openDialog(() => onPreview(triggerRef.current))}>
					<Eye />
					Preview
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={onDuplicate}>
					<Copy />
					Duplicate
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onSelect={() => openDialog(onDiscard)}>
					<Trash2 />
					Discard
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

// The step's one button, with the step's status next to it; the width doesn't change from a step to the next. What
// stops it shows when it's pressed, each with its fix. A fix keeps the focus it moves; otherwise it goes back to the button.
function BarAction({ action, status, onEdit, side = "bottom", className }) {
	const [isOpen, setIsOpen] = useState(false);
	const buttonRef = useRef(null);
	const isFixingRef = useRef(false);
	const Icon = action.icon;
	const problems = action.problems ?? [];

	function fix(field) {
		isFixingRef.current = true;
		setIsOpen(false);
		onEdit(field);
	}

	function returnFocus(event) {
		event.preventDefault();
		if (!isFixingRef.current) buttonRef.current?.focus();
		isFixingRef.current = false;
	}

	return (
		<div className={cn("flex min-w-0 items-center gap-2", className)}>
			<div className="flex min-w-0 flex-1 items-center justify-start gap-1.5 lg:justify-end">{status}</div>
			<Popover open={isOpen && problems.length > 0} onOpenChange={setIsOpen}>
				<PopoverAnchor asChild>
					<Button
						ref={buttonRef}
						onClick={() => (problems.length > 0 ? setIsOpen(true) : action.onClick())}
						disabled={action.isPending}
						aria-haspopup={problems.length > 0 ? "dialog" : undefined}
						className={cn(STEP_BUTTON, "min-w-28")}
					>
						{action.isPending ? (
							<Loader2 className="animate-spin" />
						) : action.isIconAfter ? (
							<>
								{action.label}
								<Icon data-icon="inline-end" />
							</>
						) : (
							<>
								<Icon data-icon="inline-start" />
								{action.label}
							</>
						)}
					</Button>
				</PopoverAnchor>
				<PopoverContent side={side} align="end" onCloseAutoFocus={returnFocus} className="w-80 p-0">
					<p className="px-4 pt-3.5 pb-1 text-sm font-medium">{action.problemsTitle}</p>
					<ul className="pb-2">
						{problems.map((problem) => (
							<li key={problem.id} className="flex min-h-11 items-center gap-3 px-4 py-1.5">
								<CircleX aria-hidden="true" className="size-4 shrink-0 text-red-500" />
								<span className="min-w-0 flex-1 text-sm text-pretty">{problem.message}</span>
								{problem.fix && <ButtonFix fix={problem.fix} onEdit={fix} />}
							</li>
						))}
					</ul>
				</PopoverContent>
			</Popover>
		</div>
	);
}

function ButtonFix({ fix, onEdit, onTest, isTesting, isTestDisabled }) {
	if (fix.href) {
		return (
			<Button asChild variant="outline" size="sm">
				<Link href={fix.href}>{fix.label}</Link>
			</Button>
		);
	}
	if (fix.action === "test") {
		return (
			<Button variant="outline" size="sm" onClick={onTest} disabled={isTestDisabled || isTesting} className="min-w-24">
				{isTesting ? <Loader2 className="animate-spin" /> : fix.label}
			</Button>
		);
	}
	return (
		<Button variant="outline" size="sm" onClick={() => onEdit(fix.field)}>
			{fix.label}
		</Button>
	);
}

function ButtonRow({ icon: Icon, title, description, onClick, isDisabled = false, isPending = false }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isDisabled || isPending}
			className="group/row flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/40 disabled:pointer-events-none disabled:opacity-50"
		>
			<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
				<Icon className="size-4" aria-hidden="true" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-medium">{title}</span>
				<span className="block truncate text-sm text-muted-foreground">{description}</span>
			</span>
			{isPending ? (
				<Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
			) : (
				<ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover/row:translate-x-0.5" />
			)}
		</button>
	);
}

// Browsers without field-sizing still grow the subject and the preview text with their lines.
function useFitHeight(ref, value) {
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el || (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content"))) return;
		el.style.height = "0px";
		el.style.height = `${el.scrollHeight}px`;
	}, [ref, value]);
}

// Stays until a save goes through, unlike Saved.
function ButtonRetrySave({ error, onRetry }) {
	return (
		<button type="button" onClick={onRetry} title={error} className="flex items-center gap-1.5 text-xs text-destructive hover:underline">
			<CircleAlert className="size-3.5" />
			Not saved, retry
		</button>
	);
}
