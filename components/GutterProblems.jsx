"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CircleAlert, CircleX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isBeingWritten, problemsKey } from "@/lib/editor-problems";
import { cn } from "@/lib/utils";

// The blocks' grip and its gap before the text (lib/editor-block-handle.js), which the dots keep clear of.
const GRIP_SPACE = 26;
const DOT = { width: 16, height: 24, gap: 3 };
// The message's width with its arrow: where the editor leaves less room on its left, as on a phone, it shows under the
// line instead of over the words it's about.
const MESSAGE_SPACE = 300;
// A block with many problems lists its first few.
const MAX_SHOWN = 3;
// Each dot is measured again as the issue changes, so an issue with problems everywhere shows its first ones only: the
// review step counts them all.
const MAX_DOTS = 200;

// A dot in the editor's left margin beside each block where something may look broken (lib/editor-problems.js), the way
// code editors mark a line: amber for what the review step asks to check, red for what holds the send. Pointing at it
// says what, as the review step does, and clicking it goes to it (onReveal). pinned: the block whose dot says what it's
// about until the next key or click, once the review step brought it into view.
export default function GutterProblems({ editor, pinned, onUnpin, onReveal }) {
	const [container, setContainer] = useState(null);
	const [dots, setDots] = useState([]);
	const [hovered, setHovered] = useState(null);

	useEffect(() => {
		const { view } = editor;
		let frame = null;
		let isActive = true;
		function measure() {
			frame = null;
			// A step that's hidden lays nothing out: its dots, and any message they show, go until it shows again.
			const next = view.dom.offsetParent ? readDots(view) : [];
			setContainer(view.dom.parentElement);
			setDots((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
		}
		function schedule() {
			if (isActive) frame ??= requestAnimationFrame(measure);
		}
		schedule();
		document.fonts?.ready.then(schedule);
		editor.on("transaction", schedule);
		// An HTML block open for editing hides its dot, and pictures and previews loading move the blocks below them.
		view.dom.addEventListener("focusin", schedule);
		view.dom.addEventListener("focusout", schedule);
		const observer = new ResizeObserver(schedule);
		observer.observe(view.dom);
		return () => {
			isActive = false;
			cancelAnimationFrame(frame);
			editor.off("transaction", schedule);
			view.dom.removeEventListener("focusin", schedule);
			view.dom.removeEventListener("focusout", schedule);
			observer.disconnect();
		};
	}, [editor]);

	useEffect(() => {
		if (pinned === null) return;
		const unpin = (event) => {
			if (!(event.target instanceof Element && event.target.closest("[data-problem-dot]"))) onUnpin();
		};
		document.addEventListener("pointerdown", unpin, true);
		document.addEventListener("keydown", onUnpin, true);
		return () => {
			document.removeEventListener("pointerdown", unpin, true);
			document.removeEventListener("keydown", onUnpin, true);
		};
	}, [pinned, onUnpin]);

	if (!container) return null;
	const open = hovered ?? pinned;
	return createPortal(
		dots.map((dot) => (
			<Tooltip
				key={dot.pos}
				open={open === dot.pos}
				onOpenChange={(isOpen) => setHovered((current) => (isOpen ? dot.pos : current === dot.pos ? null : current))}
			>
				<TooltipTrigger asChild>
					<button
						type="button"
						data-problem-dot=""
						aria-label={describeDot(dot)}
						onClick={() => onReveal(dot)}
						style={{ transform: `translate(${dot.left}px, ${dot.top}px)` }}
						className="group/dot absolute top-0 left-0 z-10 grid h-6 w-4 cursor-pointer place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span
							className={cn(
								"size-2 rounded-full transition-transform duration-150 ease-out group-hover/dot:scale-125",
								dot.severity === "error" ? "bg-red-500" : "bg-amber-500"
							)}
						/>
					</button>
				</TooltipTrigger>
				<TooltipContent
					side={dot.side}
					align={dot.side === "left" ? "center" : "start"}
					className="flex-col items-stretch px-3 py-2.5"
				>
					<ListProblems problems={dot.problems} />
				</TooltipContent>
			</Tooltip>
		)),
		container
	);
}

// What a screen reader says for a dot: the same first few problems as its message.
function describeDot({ severity, problems }) {
	const messages = problems.slice(0, MAX_SHOWN).map(({ message }) => message);
	const more = problems.length > MAX_SHOWN ? `, and ${problems.length - MAX_SHOWN} more` : "";
	return `${severity === "error" ? "To fix" : "To check"}: ${messages.join(". ")}${more}`;
}

// Each problem's kind and what it says, with the review step's icon for it (components/ListChecks.jsx).
function ListProblems({ problems }) {
	return (
		<ul className="flex w-64 flex-col gap-2">
			{problems.slice(0, MAX_SHOWN).map((problem, index) => {
				const isError = problem.severity === "error";
				const Icon = isError ? CircleX : CircleAlert;
				return (
					<li key={index} className="flex gap-2">
						<Icon aria-hidden="true" className={cn("mt-px size-3.5 shrink-0", isError ? "text-red-400" : "text-amber-400")} />
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="font-medium">{problem.label}</span>
							<span className="text-pretty text-background/70">{problem.message}</span>
						</span>
					</li>
				);
			})}
			{problems.length > MAX_SHOWN && <li className="pl-5.5 text-background/60">{problems.length - MAX_SHOWN} more</li>}
		</ul>
	);
}

// Each block's dot, where its first line is, or the top of an HTML block, as the grip is.
function readDots(view) {
	const { blocks } = problemsKey.getState(view.state) ?? { blocks: [] };
	const origin = view.dom.parentElement.getBoundingClientRect();
	const paddingLeft = Number.parseFloat(getComputedStyle(view.dom).paddingLeft) || 0;
	const left = Math.max(2, view.dom.getBoundingClientRect().left - origin.left + paddingLeft - GRIP_SPACE - DOT.width - DOT.gap);
	const side = origin.left >= MESSAGE_SPACE ? "left" : "bottom";
	const { activeElement } = document;
	return blocks.slice(0, MAX_DOTS).flatMap(({ pos, problems }) => {
		const node = view.state.doc.nodeAt(pos);
		const element = view.nodeDOM(pos);
		if (!node || !(element instanceof HTMLElement) || isBeingWritten(view.state, pos)) return [];
		// An HTML block open for editing says what's wrong under its HTML (components/BlockHtml.jsx).
		if (activeElement instanceof HTMLTextAreaElement && element.contains(activeElement)) return [];
		const center = getLineCenter(view, node, pos, element);
		return [
			{
				pos,
				problems,
				severity: problems.some(({ severity }) => severity === "error") ? "error" : "warning",
				side,
				left: Math.round(left),
				top: Math.round(center - origin.top - DOT.height / 2),
			},
		];
	});
}

function getLineCenter(view, node, pos, element) {
	if (node.isAtom) {
		const rect = element.getBoundingClientRect();
		return rect.height < DOT.height * 2 ? rect.top + rect.height / 2 : rect.top + 4 + DOT.height / 2;
	}
	const line = view.coordsAtPos(pos + 1);
	return (line.top + line.bottom) / 2;
}
