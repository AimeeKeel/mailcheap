"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Node } from "@tiptap/core";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { MousePointerClick, Trash2 } from "lucide-react";
import { ButtonFormat } from "@/components/MenuFormat";
import { ALIGNMENTS } from "@/components/MenuImage";
import { Button } from "@/components/ui/button";
import { BUTTON_TEXT_MAX, readButtonAlign } from "@/lib/buttons";
import { normalizeUrl } from "@/lib/editor-links";
import { getThemeVariables, resolveTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";

// Enter on a selected button edits it: the keymap tells its view.
const EDIT_EVENT = "buttonblockedit";
// What the website's buttons take from the newsletter's theme (app/globals.css).
const THEME_VARIABLES = ["--primary", "--primary-foreground", "--radius"];
// 16px on phones, where Safari zooms into smaller fields.
const FIELD = "h-11 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm";

// A button in the editor, drawn as readers get it (lib/buttons.js), in the newsletter's button colors and corners. A
// click, or Enter once it's selected, opens its text, its link and its place in the column. Enter in the text goes on to
// a missing link, and Enter in the link, Escape or Done go back to the issue, or the bin next to Done deletes it. One
// just added from the slash menu starts open.
export default function BlockButton({ node, updateAttributes, selected, editor, getPos, extension }) {
	const { text, href, align } = node.attrs;
	const [isEditing, setIsEditing] = useState(() => node.attrs.isNew && !text && !href);
	const [textDraft, setTextDraft] = useDraft(text);
	const [linkDraft, setLinkDraft] = useDraft(href, normalizeUrl);
	const wrapperRef = useRef(null);
	const textRef = useRef(null);
	const linkRef = useRef(null);
	const newsletter = extension.options.newsletter;
	const style = useMemo(() => getButtonStyle(newsletter), [newsletter]);
	const place = align === "center" ? undefined : align;

	// The issue's selection moves onto the button, so the format menu of a text selected before goes.
	function edit() {
		const pos = getPos();
		if (typeof pos === "number") editor.commands.setNodeSelection(pos);
		setIsEditing(true);
	}

	// Writing goes on after the button. A selection of the button itself wouldn't last: given back the focus, the browser
	// collapses it to the text before.
	function finish() {
		setIsEditing(false);
		const pos = getPos();
		if (typeof pos !== "number") return;
		editor
			.chain()
			.focus()
			.command(({ tr }) => Boolean(tr.setSelection(Selection.near(tr.doc.resolve(pos + node.nodeSize)))))
			.run();
	}

	// Quick to make again, so it goes at once, and undo brings it back.
	function remove() {
		const pos = getPos();
		if (typeof pos === "number") editor.chain().focus().setNodeSelection(pos).deleteSelection().run();
	}

	// The focus going elsewhere in the page ends editing. The window losing it doesn't, to another app to copy a link:
	// the browser gives it back to the field with the window.
	function leave(event) {
		if (document.hasFocus() && !event.currentTarget.contains(event.relatedTarget)) setIsEditing(false);
	}

	function changeText(event) {
		setTextDraft(event.target.value);
		updateAttributes({ text: event.target.value });
	}

	function changeLink(event) {
		setLinkDraft(event.target.value);
		updateAttributes({ href: normalizeUrl(event.target.value) });
	}

	function onFieldKeyDown(event) {
		if (event.nativeEvent.isComposing || (event.key !== "Enter" && event.key !== "Escape")) return;
		event.preventDefault();
		if (event.key === "Enter" && event.currentTarget === textRef.current && !linkDraft.trim()) linkRef.current?.focus();
		else finish();
	}

	useEffect(() => {
		const wrapper = wrapperRef.current;
		const onEdit = () => setIsEditing(true);
		wrapper?.addEventListener(EDIT_EVENT, onEdit);
		return () => wrapper?.removeEventListener(EDIT_EVENT, onEdit);
	}, []);

	// A slash command gives the editor its focus back a frame later (Tiptap's focus command), so the text takes it after.
	useEffect(() => {
		if (!isEditing) return;
		const frame = requestAnimationFrame(() => textRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, [isEditing]);

	return (
		<NodeViewWrapper ref={wrapperRef}>
			{isEditing ? (
				<div onMouseDown={keepFocus} onBlur={leave} className="my-6 overflow-hidden rounded-xl bg-card text-sm shadow-border">
					<div className="flex h-10 items-center gap-0.5 border-b border-border/60 pr-1.5 pl-4 text-xs font-medium text-muted-foreground">
						<MousePointerClick className="mr-1.5 size-3.5" aria-hidden="true" />
						<span className="flex-1">Button</span>
						{ALIGNMENTS.map(({ value, label, icon: Icon }) => (
							<ButtonFormat key={value} label={label} isActive={align === value} onClick={() => updateAttributes({ align: value })}>
								<Icon />
							</ButtonFormat>
						))}
						<span aria-hidden className="mx-1 h-5 w-px bg-border" />
						<ButtonFormat label="Delete button" onClick={remove}>
							<Trash2 />
						</ButtonFormat>
						<Button variant="ghost" size="xs" onClick={finish} className="ml-1">
							Done
						</Button>
					</div>
					<div data-button="" data-align={place} style={{ margin: 0 }} className="px-4 py-8">
						<a style={style} className={cn(!text && "opacity-60")}>
							{text || "Button text"}
						</a>
					</div>
					<div className="divide-y divide-border/60 border-t border-border/60">
						<label className="flex items-center gap-3 px-4">
							<span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">Text</span>
							<input
								ref={textRef}
								value={textDraft}
								onChange={changeText}
								onKeyDown={onFieldKeyDown}
								maxLength={BUTTON_TEXT_MAX}
								placeholder="Button text"
								aria-label="Button text"
								className={FIELD}
							/>
						</label>
						<label className="flex items-center gap-3 px-4">
							<span className="w-8 shrink-0 text-xs font-medium text-muted-foreground">Link</span>
							<input
								ref={linkRef}
								type="text"
								inputMode="url"
								value={linkDraft}
								onChange={changeLink}
								onKeyDown={onFieldKeyDown}
								onBlur={() => setLinkDraft(normalizeUrl(linkDraft))}
								placeholder="Paste a link"
								aria-label="Button link"
								autoCapitalize="off"
								autoComplete="off"
								autoCorrect="off"
								spellCheck={false}
								className={FIELD}
							/>
						</label>
					</div>
				</div>
			) : (
				<div data-button="" data-align={place} onClick={edit} className="cursor-pointer">
					{text ? (
						<a style={style} className={cn(selected && "ring-2 ring-ring ring-offset-2 ring-offset-card")}>
							{text}
						</a>
					) : (
						<span
							className={cn(
								"flex items-center gap-3 rounded-xl border border-dashed px-4 py-5 text-left text-sm text-muted-foreground",
								selected && "ring-2 ring-ring"
							)}
						>
							<MousePointerClick className="size-4 shrink-0" aria-hidden="true" />
							Add a button
						</span>
					)}
					{text && !href && (
						<span className="ml-2 inline-block rounded-md bg-amber-500/10 px-1.5 py-0.5 align-middle text-xs font-medium text-amber-700 dark:text-amber-400">
							No link
						</span>
					)}
					<span className="sr-only">Button</span>
				</div>
			)}
		</NodeViewWrapper>
	);
}

// What's typed stays the field's own: the node takes it a moment later, as toValue makes it, and only a change from
// elsewhere, like an undo, replaces it.
function useDraft(value, toValue = (draft) => draft) {
	const [draft, setDraft] = useState(value);
	const [given, setGiven] = useState(value);
	if (value !== given) {
		setGiven(value);
		if (value !== toValue(draft)) setDraft(value);
	}
	return [draft, setDraft];
}

// While it's open, a press anywhere in it but its fields leaves the focus where it was, so the button stays open.
function keepFocus(event) {
	if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
}

// The newsletter's button colors and corners, as its website draws them. MailCheap's own colors set none, so they follow
// the dashboard's light or dark mode.
function getButtonStyle(newsletter) {
	const variables = getThemeVariables(resolveTheme(newsletter?.theme));
	return Object.fromEntries(THEME_VARIABLES.filter((name) => variables[name]).map((name) => [name, variables[name]]));
}

// A button's text, link and place are attributes, written as the issue keeps them (lib/buttons.js): a
// <div data-button> around one link. newsletter: whose button colors and corners it shows.
export const ButtonBlock = Node.create({
	name: "button",
	group: "block",
	atom: true,
	selectable: true,
	draggable: false,

	addOptions() {
		return { newsletter: null };
	},

	// isNew: added from the slash menu, never saved.
	addAttributes() {
		return {
			text: {
				default: "",
				rendered: false,
				parseHTML: (element) => (element.querySelector("a") ?? element).textContent.replace(/\s+/g, " ").trim(),
			},
			href: { default: "", rendered: false, parseHTML: (element) => element.querySelector("a")?.getAttribute("href") ?? "" },
			align: { default: "center", rendered: false, parseHTML: (element) => readButtonAlign(element.getAttribute("data-align")) },
			isNew: { default: false, rendered: false, parseHTML: () => false },
		};
	},

	parseHTML() {
		return [{ tag: "div[data-button]", priority: 60 }];
	},

	renderHTML({ node }) {
		const { text, href, align } = node.attrs;
		return ["div", { "data-button": "", ...(align !== "center" && { "data-align": align }) }, ["a", href ? { href } : {}, text]];
	},

	renderText({ node }) {
		return node.attrs.text;
	},

	// Typing, pasting and dropping into its fields stay there. Elsewhere in it, clicks are its own, and a button dragged by
	// its grip still lands through ProseMirror.
	addNodeView() {
		const { editor } = this;
		return ReactNodeViewRenderer(BlockButton, {
			stopEvent: ({ event }) => {
				const isDrag = event.type.startsWith("drag") || event.type === "drop";
				return !isDrag || (!editor.view.dragging && event.target instanceof HTMLInputElement);
			},
		});
	},

	addKeyboardShortcuts() {
		return {
			Enter: () => {
				const { selection } = this.editor.state;
				if (!(selection instanceof NodeSelection) || selection.node.type !== this.type) return false;
				this.editor.view.nodeDOM(selection.from)?.querySelector("[data-node-view-wrapper]")?.dispatchEvent(new Event(EDIT_EVENT));
				return true;
			},
		};
	},
});
