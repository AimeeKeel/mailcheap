import { LogOut } from "lucide-react";
import { logout } from "@/app/(app)/actions";
import ButtonThemeToggle from "@/components/ButtonThemeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isSendingEnabled } from "@/lib/config";
import { cn } from "@/lib/utils";

export default function NavFooter() {
	const isOn = isSendingEnabled();

	return (
		<div className="flex items-center justify-between gap-2 pt-4">
			<Tooltip>
				<TooltipTrigger asChild>
					<span
						tabIndex={0}
						className="inline-flex h-7 items-center gap-2 rounded-full pr-3 pl-2.5 text-xs font-medium text-muted-foreground shadow-border outline-none"
					>
						<span
							className={cn("size-1.5 rounded-full", isOn ? "bg-emerald-500" : "bg-muted-foreground/50")}
						/>
						{isOn ? "Sending on" : "Sending off"}
					</span>
				</TooltipTrigger>
				<TooltipContent side="top">
					{isOn ? "SENDING_ENABLED is true" : "Set SENDING_ENABLED=true to send"}
				</TooltipContent>
			</Tooltip>
			<div className="flex items-center">
				<ButtonThemeToggle />
				<form action={logout}>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button type="submit" variant="ghost" size="icon" aria-label="Log out">
								<LogOut />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Log out</TooltipContent>
					</Tooltip>
				</form>
			</div>
		</div>
	);
}
