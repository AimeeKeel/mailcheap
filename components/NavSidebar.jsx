"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import LogoWordmark from "@/components/LogoWordmark";
import NavLinks from "@/components/NavLinks";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE, SIDEBAR_EXPANDED } from "@/lib/sidebar";
import { readCookie } from "@/lib/storage";
import { isSidebarCollapsed, readSidebarVisit, subscribeToSidebarVisits } from "@/lib/use-collapsed-sidebar";

// The sidebar from md up: the logo, the newsletter menu (switcher), the navigation and the account menu (footer). The
// button next to the logo folds it down to its icons (app/globals.css), and folded, the logo opens it again. The
// campaign editor folds it too while it's open, unless it's opened there (lib/use-collapsed-sidebar.js); the next page
// shows it as it was left. isCollapsed: the cookie the layout was rendered from.
export default function NavSidebar({ isCollapsed: isSavedCollapsed, isAdmin, switcher, footer }) {
	const isLeftCollapsed = useSyncExternalStore(subscribe, readIsCollapsed, () => isSavedCollapsed);
	const visit = useSyncExternalStore(subscribeToSidebarVisits, readSidebarVisit, () => 0);
	const [expandedVisit, setExpandedVisit] = useState(0);
	const isCollapsed = isSidebarCollapsed({ isLeftCollapsed, visit, expandedVisit });
	const collapseRef = useRef(null);
	const expandRef = useRef(null);

	// From the keyboard, focus goes on to the button that takes the other one's place.
	function toggle(event) {
		const hasFocusRing = event.currentTarget.matches(":focus-visible");
		flushSync(() => {
			if (isCollapsed) setExpandedVisit(visit);
			saveIsCollapsed(!isCollapsed);
		});
		if (hasFocusRing) (isCollapsed ? collapseRef : expandRef).current.focus();
	}

	return (
		<aside
			data-sidebar-collapsed={isCollapsed ? "" : undefined}
			data-sidebar-expanded={visit !== 0 && !isCollapsed ? "" : undefined}
			data-sidebar=""
			className="sticky top-(--plan-bar-height) hidden h-[calc(100dvh-var(--plan-bar-height))] w-(--sidebar-width) shrink-0 flex-col border-r border-border/60 pb-4 transition-[width] duration-250 ease-drawer motion-reduce:transition-none md:flex"
		>
			{/* A window too short for the sidebar scrolls its navigation, and the account menu stays at the bottom. */}
			<div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 pt-4">
				<div className="relative mb-4 flex h-9 shrink-0 items-center">
					<div inert={isCollapsed} className="flex min-w-0 flex-1 items-center">
						<LogoWordmark href="/" className="h-9 px-2.5 [&>span]:sidebar-label" />
						<div className="mr-1.5 ml-auto sidebar-label">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										ref={collapseRef}
										variant="ghost"
										size="icon-sm"
										onClick={toggle}
										aria-label="Collapse sidebar"
										className="text-muted-foreground"
									>
										<PanelLeftClose />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="bottom">Collapse sidebar</TooltipContent>
							</Tooltip>
						</div>
					</div>
					{/* Folded, the logo opens the sidebar: on hover this button's background, opaque, takes the logo's place. */}
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								ref={expandRef}
								type="button"
								onClick={toggle}
								inert={!isCollapsed}
								aria-label="Expand sidebar"
								className="group/expand absolute inset-y-0 left-0 grid w-11 place-items-center rounded-lg outline-none transition-[background-color,box-shadow] duration-150 hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--background))] focus-visible:bg-[color-mix(in_oklab,var(--muted)_60%,var(--background))] focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								<PanelLeftOpen className="size-4 opacity-0 transition-opacity duration-150 group-hover/expand:opacity-100 group-focus-visible/expand:opacity-100" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="right" sideOffset={8}>
							Expand sidebar
						</TooltipContent>
					</Tooltip>
				</div>
				<div className="mb-5">{switcher}</div>
				<NavLinks isAdmin={isAdmin} isCollapsed={isCollapsed} />
			</div>
			<div className="shrink-0 px-3 pt-4">{footer}</div>
		</aside>
	);
}

// The cookie is the sidebar's state. The layout doesn't render again on navigation, and a page brought back from the
// history comes with the layout it was rendered with: the cookie has the last choice.
const listeners = new Set();

function subscribe(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function readIsCollapsed() {
	return readCookie(SIDEBAR_COOKIE) === SIDEBAR_COLLAPSED;
}

function saveIsCollapsed(isCollapsed) {
	document.cookie = `${SIDEBAR_COOKIE}=${isCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED}; path=/; max-age=31536000; samesite=lax`;
	for (const listener of listeners) listener();
}
