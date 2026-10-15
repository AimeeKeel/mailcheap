"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A form's save bar, the form's last child: at the bottom of the screen in the form's column while the form has
// unsaved changes, with Discard and Save (or ⌘S, Ctrl+S), then Saved for a moment. Its place stays at the end of the
// page, whose bottom padding it takes back (LayoutDashboard's), so the form's end never hides under it. The
// get-started pill steps aside while it shows (app/globals.css). savedAt: the last save's time, null after a discard.
export default function BarSave({ isDirty, isSaving, savedAt, onDiscard, label = "Save" }) {
	const slotRef = useRef(null);
	const saveRef = useRef(null);
	const [fadedAt, setFadedAt] = useState(null);
	const isSaved = !isDirty && !isSaving && savedAt !== null;
	const isShown = isDirty || isSaving || (isSaved && fadedAt !== savedAt);

	useClearOfChat(slotRef, isShown);
	useLeaveWarning(isDirty);

	useEffect(() => {
		if (savedAt === null) return;
		const timeout = setTimeout(() => setFadedAt(savedAt), SAVED_MS);
		return () => clearTimeout(timeout);
	}, [savedAt]);

	const onKeyDown = useEffectEvent((event) => {
		if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
		event.preventDefault();
		if (isDirty && !isSaving) saveRef.current.form.requestSubmit(saveRef.current);
	});

	useEffect(() => {
		function handleKeyDown(event) {
			onKeyDown(event);
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<div
			ref={slotRef}
			data-save-bar
			data-shown={isShown ? "" : undefined}
			className="pointer-events-none sticky bottom-0 z-30 -mb-6 pb-(--dock-bottom) md:-mb-10"
		>
			<div
				inert={!isShown}
				className={cn(
					"pointer-events-auto mr-(--save-bar-inset) flex h-10 items-center gap-1 rounded-xl bg-card p-1.5 pl-3.5 shadow-float sm:pl-4 transition-[translate,opacity] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity",
					isShown ? "duration-250" : "translate-y-[calc(100%+var(--dock-bottom))] opacity-0 duration-200 motion-reduce:translate-y-0"
				)}
			>
				<p aria-live="polite" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
					{isSaved ? (
						<span key={savedAt} className="flex items-center gap-1.5">
							<Check className="size-3.5 shrink-0 animate-icon-in" />
							Saved
						</span>
					) : (
						"Unsaved changes"
					)}
				</p>
				<div inert={isSaved} className={cn("flex shrink-0 items-center gap-1 transition-opacity duration-150", isSaved && "opacity-0")}>
					<Button type="button" variant="ghost" size="sm" disabled={isSaving} onClick={onDiscard}>
						Discard
					</Button>
					<Button ref={saveRef} type="submit" size="sm" disabled={isSaving} aria-keyshortcuts="Meta+S Control+S" className="relative">
						<span className={cn(isSaving && "opacity-0")}>{label}</span>
						{isSaving && <Loader2 className="absolute animate-spin" />}
					</Button>
				</div>
			</div>
		</div>
	);
}

// Where the column reaches the support chat's button, in the bottom right corner (app/globals.css), the bar ends
// --chat-clearance from the right edge of the screen, like the get-started pill.
function useClearOfChat(slotRef, isShown) {
	useLayoutEffect(() => {
		if (!isShown) return;
		const slot = slotRef.current;
		function update() {
			const clearance = Number.parseFloat(getComputedStyle(slot).getPropertyValue("--chat-clearance")) || 0;
			const overlap = slot.getBoundingClientRect().right + clearance - document.documentElement.clientWidth;
			slot.style.setProperty("--save-bar-inset", `${Math.max(0, overlap)}px`);
		}
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [slotRef, isShown]);
}

// Closing or reloading the tab gets the browser's own question; a link to another dashboard page asks here.
function useLeaveWarning(isDirty) {
	const onBeforeUnload = useEffectEvent((event) => {
		if (isDirty) event.preventDefault();
	});

	const onClick = useEffectEvent((event) => {
		if (!isDirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
		if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
		const url = new URL(link.href);
		if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
		if (window.confirm(LEAVE_QUESTION)) return;
		event.preventDefault();
		event.stopPropagation();
	});

	useEffect(() => {
		function handleBeforeUnload(event) {
			onBeforeUnload(event);
		}
		function handleClick(event) {
			onClick(event);
		}
		window.addEventListener("beforeunload", handleBeforeUnload);
		window.addEventListener("click", handleClick, true);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			window.removeEventListener("click", handleClick, true);
		};
	}, []);
}

const SAVED_MS = 1500;
const LEAVE_QUESTION = "Leave without saving your changes?";
