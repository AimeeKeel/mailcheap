import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// The cross that closes a dashboard helper, like the own-domain and inbox check notices, with room around it to tap.
// outline: on a chip of its own, for a helper that could pass for one of the settings around it.
export default function ButtonClose({ onClick, variant = "ghost", className }) {
	const isOutline = variant === "outline";
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Close"
			title="Close"
			className={cn(
				"relative grid shrink-0 place-items-center transition-[color,background-color,box-shadow,scale] duration-150 after:absolute after:-inset-2 active:scale-[0.96]",
				isOutline
					? "size-7 rounded-lg bg-background text-foreground/70 shadow-border hover:text-foreground hover:shadow-border-hover"
					: "size-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
				className
			)}
		>
			<X className={isOutline ? "size-4" : "size-3.5"} aria-hidden="true" />
		</button>
	);
}
