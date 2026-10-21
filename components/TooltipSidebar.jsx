"use client";

import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Names what the folded sidebar shows as an icon (NavSidebar). It only opens while the sidebar is folded, and closes as
// it unfolds: one opened while the sidebar showed its labels would have nothing to close it, and would show up as soon
// as it folds.
export default function TooltipSidebar({ isFolded, label, children }) {
	const [isOpen, setIsOpen] = useState(false);
	if (isOpen && !isFolded) setIsOpen(false);

	return (
		<Tooltip open={isOpen} onOpenChange={(open) => setIsOpen(open && isFolded)}>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side="right" sideOffset={8}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
