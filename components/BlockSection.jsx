"use client";

import { createContext, use, useEffect, useState } from "react";
import { Node } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { ChevronDown, ChevronsUpDown, Globe, Mail, Plus, SquareSplitVertical, Ungroup, UsersRound } from "lucide-react";
import LinkHelp from "@/components/LinkHelp";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/format";
import {
	SECTION_PLACES,
	SECTION_PLACE_LABELS,
	describeSectionGroup,
	describeSectionReaders,
	formatSectionGroup,
	readSectionGroup,
	readSectionRule,
	writeSectionRule,
} from "@/lib/sections";
import { cn } from "@/lib/utils";

// What the issue's sections pick from, which the campaign's page gives (components/FormCampaign.jsx): the newsletter's
// segments, { id, name, description }, its tags as loadTags() reads them, how many of the issue's readers a tag or a
// segment has (countReaders), and a segment made on the spot (newSegment(onSaved)).
export const SectionsContext = createContext(null);

const EVERYONE = "everyone";
const NEW_SEGMENT = "new";
// A section holds any of the issue's blocks but another section (lib/sections.js).
const SECTION_CONTENT = "(paragraph | heading | blockquote | bulletList | orderedList | horizontalRule | image | callout | button | htmlBlock)+";

// Part of an issue only some readers get, or only its emails or its website show (lib/sections.js): an outline around
// its blocks, and a label saying who and where, which opens its settings. Picking readers makes it email only, as the
// website doesn't know who's reading; back on the website, every visitor sees it. One just made opens its settings.
export default function BlockSection({ node, updateAttributes, editor, getPos }) {
	const context = use(SectionsContext);
	const segments = context?.segments ?? [];
	const [isOpen, setIsOpen] = useState(() => Boolean(node.attrs.isNew));
	const rule = readSectionRule(node.attrs);
	const place = rule?.place ?? "both";
	const isDeleted = rule?.group?.kind === "segment" && !segments.some(({ id }) => id === rule.group.value);
	const hasProblem = !rule || isDeleted;
	const PlaceIcon = place === "email" ? Mail : place === "web" ? Globe : UsersRound;

	// Opened once: the attribute stays out of the issue's HTML and its undo history.
	useEffect(() => {
		const pos = getPos();
		if (!node.attrs.isNew || typeof pos !== "number") return;
		editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "isNew", false).setMeta("addToHistory", false));
	}, [editor, getPos, node.attrs.isNew]);

	function change(next) {
		updateAttributes(toNodeAttributes(next));
	}

	// The section's blocks back in the issue, for everyone, everywhere.
	function remove() {
		const pos = getPos();
		if (typeof pos !== "number") return;
		setIsOpen(false);
		editor
			.chain()
			.focus()
			.command(({ tr }) => Boolean(tr.replaceWith(pos, pos + node.nodeSize, node.content)))
			.run();
	}

	// The same readers' opposite right after it, ready to write in: an if-else.
	function addOpposite() {
		const pos = getPos();
		if (typeof pos !== "number" || !rule?.group) return;
		const after = pos + node.nodeSize;
		setIsOpen(false);
		editor
			.chain()
			.focus()
			.command(({ tr, state }) => {
				const { section, paragraph } = state.schema.nodes;
				tr.insert(after, section.create(toNodeAttributes({ ...rule, isExcept: !rule.isExcept }), paragraph.create()));
				tr.setSelection(TextSelection.create(tr.doc, after + 2));
				return true;
			})
			.run();
	}

	return (
		<NodeViewWrapper
			data-section-view=""
			className={cn("my-8 rounded-xl border border-dashed px-4 pt-3 pb-1", hasProblem ? "border-destructive/50" : "border-foreground/20")}
		>
			<div contentEditable={false} className="mb-3 flex min-w-0">
				<Popover open={isOpen} onOpenChange={setIsOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className={cn(
								"-ml-1 flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] data-[state=open]:bg-accent",
								hasProblem && "text-destructive"
							)}
						>
							<PlaceIcon aria-hidden="true" className="size-3.5 shrink-0" />
							<span className="truncate">
								{rule ? describeSectionReaders(rule, segments) : "Pick who sees this section"}
								<span className="text-muted-foreground"> · {SECTION_PLACE_LABELS[place]}</span>
							</span>
							<ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						className="w-80 p-0"
						onCloseAutoFocus={(event) => {
							event.preventDefault();
							editor.commands.focus();
						}}
					>
						<SettingsSection rule={rule} isDeleted={isDeleted} onChange={change} onAddOpposite={addOpposite} onRemove={remove} />
					</PopoverContent>
				</Popover>
			</div>
			<NodeViewContent className="[&_[data-node-view-content-react]>:first-child]:mt-0" />
		</NodeViewWrapper>
	);
}

// Who sees the section and where it shows, with how many of the issue's readers that is.
function SettingsSection({ rule, isDeleted, onChange, onAddOpposite, onRemove }) {
	const context = use(SectionsContext);
	const group = rule?.group ?? null;
	const groupKey = group ? formatSectionGroup(group) : null;
	const isExcept = Boolean(rule?.isExcept);
	const place = rule?.place ?? "both";
	const [counted, setCounted] = useState(null);
	const count = counted?.key === groupKey ? counted.result : null;

	// Counted afresh for each group picked, and only the latest answer shows. One that fails shows no count.
	useEffect(() => {
		if (place === "web" || isDeleted || !groupKey || !context) return;
		let isCurrent = true;
		context.countReaders(groupKey).then((result) => isCurrent && setCounted({ key: groupKey, result: result ?? { isMissing: true } }));
		return () => {
			isCurrent = false;
		};
	}, [context, groupKey, place, isDeleted]);

	// Someone picked makes it email only: the website shows its sections to every visitor.
	function pickGroup(next) {
		onChange({ group: next, isExcept: next ? isExcept : false, place: next && place !== "email" ? "email" : place });
	}

	function pickPlace(next) {
		onChange(next === "web" ? { group: null, isExcept: false, place: next } : { group, isExcept, place: next });
	}

	const shown = isExcept ? count?.readers - count?.count : count?.count;
	const status =
		place === "web"
			? "Every visitor of your website sees it, and no email has it."
			: isDeleted
				? "Its segment was deleted: pick who sees it."
				: !group
					? "Everyone who gets this issue sees it in their email."
					: !count
						? "Counting readers…"
						: count.isMissing
							? "Only the readers it names see it in their email."
							: `${formatNumber(shown)} of the ${formatNumber(count.readers)} readers who get this issue see it in their email.`;

	return (
		<div className="flex flex-col">
			<div className="flex flex-col gap-4 p-4">
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Who sees this section</p>
					<MenuReaders group={group} isDeleted={isDeleted} isDisabled={place === "web"} onPick={pickGroup} />
					<label className={cn("flex items-center justify-between gap-3 text-sm", (!group || place === "web") && "text-muted-foreground")}>
						Everyone except them
						<Switch checked={isExcept} disabled={!group || place === "web"} onCheckedChange={(checked) => onChange({ group, isExcept: checked, place })} />
					</label>
				</div>
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Show it in</p>
					<div role="radiogroup" aria-label="Show it in" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
						{SECTION_PLACES.map((item) => (
							<button
								key={item}
								type="button"
								role="radio"
								aria-checked={place === item}
								onClick={() => pickPlace(item)}
								className={cn(
									"h-7 rounded-md px-1 text-xs font-medium whitespace-nowrap outline-none transition-[background-color,color,scale] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]",
									place === item ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
								)}
							>
								{SECTION_PLACE_LABELS[item]}
							</button>
						))}
					</div>
				</div>
				<p role="status" className={cn("text-sm text-pretty text-muted-foreground tabular-nums", isDeleted && place !== "web" && "text-destructive")}>
					{status}
					{group && place === "both" && " Every visitor of your website sees it too: it doesn't know who's reading."}
				</p>
			</div>
			<div className="flex flex-col border-t p-1">
				{group && (
					<ButtonSettings icon={SquareSplitVertical} onClick={onAddOpposite}>
						Add a version for {isExcept ? "them" : "everyone else"}
					</ButtonSettings>
				)}
				<ButtonSettings icon={Ungroup} onClick={onRemove}>
					Remove the section, keep its content
				</ButtonSettings>
				<p className="px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
					<LinkHelp article="writing" section="sections" className="font-normal">
						How sections work
					</LinkHelp>
				</p>
			</div>
		</div>
	);
}

// Everyone, a tag or one of the newsletter's segments, or a segment made here. The tags are read as it first opens.
function MenuReaders({ group, isDeleted, isDisabled, onPick }) {
	const context = use(SectionsContext);
	const segments = context?.segments ?? [];
	const [tags, setTags] = useState(null);
	const value = group ? formatSectionGroup(group) : EVERYONE;
	const tagNames = tags?.map(({ name }) => name) ?? [];
	// A tag no contact has yet still shows as picked.
	const shownTags = group?.kind === "tag" && tags && !tagNames.includes(group.value) ? [{ name: group.value, contacts: 0 }, ...tags] : (tags ?? []);
	const label = group ? describeSectionGroup(group, segments) : "Everyone";

	function load(open) {
		if (open && !tags) context?.loadTags().then(setTags);
	}

	function pick(next) {
		if (next === NEW_SEGMENT) return context?.newSegment((id) => onPick({ kind: "segment", value: id }));
		onPick(next === EVERYONE ? null : readSectionGroup(next));
	}

	return (
		<DropdownMenu onOpenChange={load}>
			<DropdownMenuTrigger asChild disabled={isDisabled}>
				<button
					type="button"
					className={cn(
						"flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border bg-background px-3 text-left text-sm outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:bg-muted/50",
						isDeleted && "border-destructive/50 text-destructive"
					)}
				>
					<span className="min-w-0 flex-1 truncate">{label}</span>
					<ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" collisionPadding={12} className="max-h-80 w-(--radix-dropdown-menu-trigger-width) min-w-64">
				<DropdownMenuRadioGroup value={value} onValueChange={pick}>
					<DropdownMenuRadioItem value={EVERYONE}>Everyone</DropdownMenuRadioItem>
					<DropdownMenuSeparator />
					<DropdownMenuLabel className="text-xs text-muted-foreground">Readers tagged</DropdownMenuLabel>
					{!tags && <p className="px-2 py-1.5 text-sm text-muted-foreground">Loading tags…</p>}
					{tags && shownTags.length === 0 && (
						<p className="px-2 py-1.5 text-sm text-pretty text-muted-foreground">
							No tags yet. <LinkHelp article="contacts" section="tags" className="font-normal">Tagging contacts</LinkHelp>
						</p>
					)}
					{shownTags.map(({ name, contacts }) => (
						<DropdownMenuRadioItem key={name} value={formatSectionGroup({ kind: "tag", value: name })}>
							<span className="min-w-0 flex-1 truncate">{name}</span>
							<span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(contacts)}</span>
						</DropdownMenuRadioItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuLabel className="text-xs text-muted-foreground">Readers in a segment</DropdownMenuLabel>
					{segments.map(({ id, name, description }) => (
						<DropdownMenuRadioItem key={id} value={formatSectionGroup({ kind: "segment", value: id })} className="items-start py-2">
							<span className="flex min-w-0 flex-col gap-0.5">
								<span className="truncate">{name}</span>
								{description && <span className="line-clamp-2 text-xs text-pretty text-muted-foreground">{description}</span>}
							</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
				<DropdownMenuItem onSelect={() => pick(NEW_SEGMENT)} className="text-muted-foreground">
					<Plus />
					New segment
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function ButtonSettings({ icon: Icon, onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex h-8 items-center gap-2 rounded-lg px-2 text-left text-sm outline-none transition-colors duration-150 hover:bg-muted focus-visible:bg-muted"
		>
			<Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
			{children}
		</button>
	);
}

// The node's attributes for some rules, as the issue's HTML keeps them (lib/sections.js).
function toNodeAttributes(rule) {
	const attributes = writeSectionRule(rule);
	return { show: attributes["data-show"] ?? null, hide: attributes["data-hide"] ?? null, where: attributes["data-where"] ?? null };
}

// Kept as <section data-section> with the rules' attributes as they were read, so one the editor can't read stays hidden
// to everyone until it's picked again. Its own data-* attributes find one the API wrote too. isNew: just made, never
// saved, its settings open.
export const Section = Node.create({
	name: "section",
	group: "block",
	content: SECTION_CONTENT,
	defining: true,

	addAttributes() {
		return {
			show: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-show") },
			hide: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-hide") },
			where: { default: null, rendered: false, parseHTML: (element) => element.getAttribute("data-where") },
			isNew: { default: false, rendered: false, parseHTML: () => false },
		};
	},

	parseHTML() {
		return ["data-section", "data-show", "data-hide", "data-where"].map((name) => ({ tag: `section[${name}]` }));
	},

	renderHTML({ node }) {
		const { show, hide, where } = node.attrs;
		const attributes = { "data-section": "", ...(show !== null && { "data-show": show }), ...(hide !== null && { "data-hide": hide }) };
		return ["section", { ...attributes, ...(where !== null && { "data-where": where }) }, 0];
	},

	addNodeView() {
		return ReactNodeViewRenderer(BlockSection);
	},
});

// Whether the selection is in a section, or holds one: a section can't go in another.
export function isInSection(state) {
	const { $from, from, to } = state.selection;
	for (let depth = $from.depth; depth > 0; depth -= 1) if ($from.node(depth).type.name === "section") return true;
	let holds = false;
	state.doc.nodesBetween(from, to, (child) => {
		holds ||= child.type.name === "section";
		return !holds;
	});
	return holds;
}
