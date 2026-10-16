"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Monitor, Smartphone, X } from "lucide-react";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// The email over the whole dashboard on a dimmed backdrop: in a mail app's window as wide as a desktop gives it, or on a
// phone. Escape, the close button and a click on the dimmed space close it; Radix keeps the focus inside meanwhile.
export default function DialogPreviewEmail({ isOpen, onOpenChange, onCloseAutoFocus, ...email }) {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogPortal>
				<DialogOverlay className="bg-black/70" />
				<DialogPrimitive.Content
					aria-describedby={undefined}
					onCloseAutoFocus={onCloseAutoFocus}
					className="fixed inset-0 z-50 outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-2 data-closed:animate-out data-closed:fade-out-0"
				>
					<DialogTitle className="sr-only">Preview</DialogTitle>
					<Stage {...email} onClose={() => onOpenChange(false)} />
				</DialogPrimitive.Content>
			</DialogPortal>
		</Dialog>
	);
}

// Narrower than the device (a phone showing the desktop), the device scales down whole instead of reflowing.
function Stage({ html, sender, subject, previewText, onClose }) {
	const [device, setDevice] = useState(() => (window.matchMedia(SMALL_SCREEN).matches ? "mobile" : "desktop"));
	const [space, setSpace] = useState(null);
	const spaceRef = useRef(null);
	const isPressOnDim = useRef(false);
	const isDesktop = device === "desktop";
	const width = isDesktop ? clamp(space?.width ?? DESKTOP.maxWidth, DESKTOP.minWidth, DESKTOP.maxWidth) : PHONE.width;
	const scale = space ? Math.min(1, space.width / width) : 1;
	const fullHeight = space ? space.height / scale : null;
	const height = isDesktop ? fullHeight : fullHeight && Math.min(PHONE.height, fullHeight);

	useLayoutEffect(() => {
		const observer = new ResizeObserver(([entry]) => setSpace({ width: entry.contentRect.width, height: entry.contentRect.height }));
		observer.observe(spaceRef.current);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			data-dim
			onPointerDown={(event) => (isPressOnDim.current = isDim(event.target))}
			onClick={(event) => isPressOnDim.current && isDim(event.target) && onClose()}
			className="flex h-full flex-col"
		>
			<div data-dim className="relative flex h-16 shrink-0 items-center justify-center px-16">
				<div role="radiogroup" aria-label="Device" className="flex items-center gap-1 rounded-full bg-white/10 p-1">
					{DEVICES.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							type="button"
							role="radio"
							aria-checked={device === id}
							onClick={() => setDevice(id)}
							className={cn(
								"flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium outline-none transition-[color,background-color,scale] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-white/40 active:scale-[0.97]",
								device === id ? "bg-white text-zinc-900" : "text-white/70 hover:text-white"
							)}
						>
							<Icon className="size-4" aria-hidden="true" />
							{label}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close preview"
					className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white outline-none transition-[background-color,scale] duration-150 ease-out hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/40 active:scale-[0.96] sm:right-5"
				>
					<X className="size-4" />
				</button>
			</div>
			<div data-dim className="min-h-0 flex-1 px-3 pb-3 sm:px-8 sm:pb-8">
				<div ref={spaceRef} data-dim className="relative h-full">
					{space && (
						<div
							key={device}
							style={{ width, height, transform: `translateX(-50%) scale(${scale})` }}
							className="absolute top-0 left-1/2 origin-top animate-fade-in"
						>
							{isDesktop ? (
								<FrameDesktop sender={sender} subject={subject} html={html} />
							) : (
								<FramePhone sender={sender} subject={subject} previewText={previewText} html={html} />
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// A mail app's reading pane: the window's bar, the message's header, then the email at the pane's whole width, where
// it centers itself like inboxes show it. The phone shows the preview text, as an inbox's list does.
function FrameDesktop({ sender, subject, html }) {
	return (
		<div className="flex h-full flex-col overflow-hidden rounded-xl bg-white text-zinc-900 shadow-2xl ring-1 ring-black/10">
			<div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4">
				{["bg-[#ff5f57]", "bg-[#febc2e]", "bg-[#28c840]"].map((color) => (
					<span key={color} aria-hidden="true" className={cn("size-3 rounded-full", color)} />
				))}
				<p className="min-w-0 flex-1 truncate px-16 text-center text-xs font-medium text-zinc-500">{subject || "No subject"}</p>
			</div>
			<div className="shrink-0 border-b border-zinc-200 px-8 pt-6 pb-5">
				<h2 className="truncate text-xl font-semibold tracking-tight">{subject || "No subject"}</h2>
				<div className="mt-4 flex items-center gap-3 text-sm">
					<AvatarNewsletter newsletter={sender} size={40} className="rounded-full bg-zinc-100 text-zinc-500" />
					<div className="min-w-0 flex-1">
						<p className="truncate">
							<span className="font-semibold">{sender.fromName || sender.name}</span>{" "}
							<span className="text-zinc-500">&lt;{sender.fromEmail}&gt;</span>
						</p>
						<p className="truncate text-zinc-500">to me</p>
					</div>
					<span className="shrink-0 text-xs text-zinc-500">Now</span>
				</div>
			</div>
			<FrameEmail html={html} />
		</div>
	);
}

// A phone's screen in its bezel, with the inbox's header above the email.
function FramePhone({ sender, subject, previewText, html }) {
	return (
		<div className="h-full rounded-[3rem] bg-zinc-950 p-3 shadow-2xl ring-1 ring-white/15">
			<div className="relative flex h-full flex-col overflow-hidden rounded-[2.25rem] bg-white text-zinc-900">
				<div className="relative flex h-11 shrink-0 items-center justify-between px-7 text-xs font-semibold tabular-nums">
					<span>9:41</span>
					<span aria-hidden="true" className="absolute top-2.5 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-950" />
					<span aria-hidden="true" className="flex items-center gap-1">
						<span className="h-2.5 w-4 rounded-[3px] border border-zinc-900" />
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-3 border-b border-zinc-200 px-4 pt-1 pb-3 text-sm">
					<AvatarNewsletter newsletter={sender} size={36} className="rounded-full bg-zinc-100 text-zinc-500" />
					<div className="min-w-0 flex-1">
						<p className="truncate font-semibold">{sender.fromName || sender.name}</p>
						<p className="truncate">
							<span className="font-medium">{subject || "No subject"}</span>
							{previewText && <span className="text-zinc-500"> — {previewText}</span>}
						</p>
					</div>
				</div>
				<FrameEmail html={html} />
			</div>
		</div>
	);
}

function FrameEmail({ html }) {
	// Without allow-scripts nothing in the email runs.
	return <iframe title="Email preview" sandbox="" srcDoc={html} className="min-h-0 w-full flex-1 bg-white" />;
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function isDim(target) {
	return target instanceof Element && target.hasAttribute("data-dim");
}

const SMALL_SCREEN = "(max-width: 639px)";
const DESKTOP = { minWidth: 1024, maxWidth: 1280 };
const PHONE = { width: 390, height: 844 };
const DEVICES = [
	{ id: "desktop", label: "Desktop", icon: Monitor },
	{ id: "mobile", label: "Mobile", icon: Smartphone },
];
