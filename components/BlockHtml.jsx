"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Node } from "@tiptap/core";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { CodeXml } from "lucide-react";
import FrameIssue from "@/components/FrameIssue";
import LinkHelp from "@/components/LinkHelp";
import { Button } from "@/components/ui/button";
import { renderBlockPreview } from "@/lib/render-email";
import { cn } from "@/lib/utils";

// Enter on a selected block edits it: the keymap tells its view.
const EDIT_EVENT = "htmlblockedit";

// An HTML block in the editor: the HTML its author writes, and under it what readers get once it's cleaned
// (lib/clean-html.js), in a frame where nothing runs. Out of editing, only that. A click, or Enter once it's selected,
// edits it, and Escape or Done goes back to the issue. One just added from the slash menu starts in editing.
export default function BlockHtml({ node, updateAttributes, selected, editor, getPos, extension }) {
	const { html } = node.attrs;
	const [isEditing, setIsEditing] = useState(() => node.attrs.isNew && !html);
	const wrapperRef = useRef(null);
	const textareaRef = useRef(null);
	const preview = useDeferredValue(html);
	const newsletter = extension.options.newsletter;
	const previewHtml = useMemo(() => renderBlockPreview(preview, newsletter), [preview, newsletter]);

	// The issue's selection moves onto the block, so the format menu of a text selected before goes.
	function edit() {
		const pos = getPos();
		if (typeof pos === "number") editor.commands.setNodeSelection(pos);
		setIsEditing(true);
	}

	// Writing goes on after the block. A selection of the block itself wouldn't last: given back the focus, the browser
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

	useEffect(() => {
		const wrapper = wrapperRef.current;
		const onEdit = () => setIsEditing(true);
		wrapper?.addEventListener(EDIT_EVENT, onEdit);
		return () => wrapper?.removeEventListener(EDIT_EVENT, onEdit);
	}, []);

	// A slash command gives the editor its focus back a frame later (Tiptap's focus command), so the HTML takes it after.
	useEffect(() => {
		if (!isEditing) return;
		const frame = requestAnimationFrame(() => textareaRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, [isEditing]);

	// The field types into the block, and follows it when the block changes some other way.
	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea && textarea.value !== html) textarea.value = html;
	}, [html]);

	// While editing, a click anywhere in the block but its HTML and buttons keeps the focus in the HTML.
	function keepFocus(event) {
		if (isEditing && !(event.target instanceof HTMLTextAreaElement) && !event.target.closest("a, button")) event.preventDefault();
	}

	return (
		<NodeViewWrapper ref={wrapperRef} className="my-6">
			<div
				onMouseDown={keepFocus}
				onClick={isEditing ? undefined : edit}
				onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setIsEditing(false)}
				className={cn(
					"group/html relative rounded-xl transition-shadow duration-150",
					isEditing
						? "overflow-hidden bg-card shadow-border"
						: cn("cursor-pointer", selected ? "ring-2 ring-ring" : "hover:ring-1 hover:ring-border")
				)}
			>
				{isEditing && (
					<div className="flex h-10 items-center gap-2 border-b border-border/60 pr-1.5 pl-4 text-xs font-medium text-muted-foreground">
						<CodeXml className="size-3.5" aria-hidden="true" />
						<span className="flex-1">HTML</span>
						<Button variant="ghost" size="xs" onMouseDown={(event) => event.preventDefault()} onClick={finish}>
							Done
						</Button>
					</div>
				)}
				{isEditing && (
					<textarea
						ref={textareaRef}
						defaultValue={html}
						autoFocus
						onChange={(event) => updateAttributes({ html: event.target.value })}
						onKeyDown={(event) => {
							if (event.key !== "Escape" && !(event.key === "Enter" && (event.metaKey || event.ctrlKey))) return;
							event.preventDefault();
							finish();
						}}
						placeholder="Paste or type HTML"
						spellCheck={false}
						aria-label="HTML"
						className="block min-h-40 w-full resize-none bg-transparent px-4 py-3 font-mono text-[13px] leading-6 outline-none [field-sizing:content] placeholder:text-muted-foreground"
					/>
				)}
				{previewHtml ? (
					<div inert className={cn(isEditing && "border-t border-border/60")}>
						<FrameIssue html={previewHtml} title="HTML preview" initialHeight={0} className={cn(isEditing && "rounded-none")} />
					</div>
				) : (
					!isEditing && (
						<div className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
							<CodeXml className="size-4 shrink-0" aria-hidden="true" />
							{html ? "Nothing to show: scripts, forms and frames are removed" : "Add HTML"}
						</div>
					)
				)}
				{isEditing ? (
					<div className="border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
						Use inline styles: scripts, forms and style tags are removed. <LinkHelp article="writing" section="html" />
					</div>
				) : (
					previewHtml && (
						<span className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-md bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground opacity-0 shadow-border transition-opacity duration-150 group-hover/html:opacity-100">
							<CodeXml className="size-3" aria-hidden="true" />
							HTML
						</span>
					)
				)}
				{!isEditing && <span className="sr-only">HTML block</span>}
			</div>
		</NodeViewWrapper>
	);
}

// The block's HTML is stored as the text of a <div data-html-block> (lib/clean-html.js), so the issue's cleaners read it
// as words until an email or the website puts it back. newsletter: whose email design the preview shows.
export const HtmlBlock = Node.create({
	name: "htmlBlock",
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
			html: { default: "", rendered: false, parseHTML: (element) => element.textContent ?? "" },
			isNew: { default: false, rendered: false, parseHTML: () => false },
		};
	},

	parseHTML() {
		return [{ tag: "div[data-html-block]", priority: 60 }];
	},

	renderHTML({ node }) {
		return ["div", { "data-html-block": "" }, node.attrs.html];
	},

	renderText({ node }) {
		return node.attrs.html;
	},

	// Typing, pasting and dropping into its HTML stay there. Elsewhere in the block, clicks are its own, and a block
	// dragged by its grip still lands through ProseMirror.
	addNodeView() {
		const { editor } = this;
		return ReactNodeViewRenderer(BlockHtml, {
			stopEvent: ({ event }) => {
				const isDrag = event.type.startsWith("drag") || event.type === "drop";
				return !isDrag || (!editor.view.dragging && event.target instanceof HTMLTextAreaElement);
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
