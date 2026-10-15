import { formatNumber } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { siteExtensions } from "@/lib/site-extensions";
import { cn } from "@/lib/utils";

// Under the plans: sending more than the largest plan gets a price in the support chat.
export default function TextContactUs({ className }) {
	const { supportChatPath } = siteExtensions;
	if (!supportChatPath) return null;

	return (
		<p className={cn("text-center text-sm text-muted-foreground", className)}>
			More than {formatNumber(PLANS.at(-1).emailsPerMonth)} emails?{" "}
			<a href={supportChatPath} className="font-medium text-foreground underline underline-offset-4">
				Chat with us
			</a>
		</p>
	);
}
