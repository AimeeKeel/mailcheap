import { Send, Users } from "lucide-react";
import { choosePlan } from "@/app/(account)/billing/actions";
import { Button } from "@/components/ui/button";
import { formatNumber, formatUsd } from "@/lib/format";
import { getPrice } from "@/lib/plans";
import { cn } from "@/lib/utils";

const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// action: "subscribe" opens Checkout, "switch" Stripe's plan change page, "current" does nothing.
// href: on the public pages, a plain link to Checkout through sign-in. Not a <Link>: a prefetch would open
// a Checkout session.
export default function CardPlan({ plan, interval, action, href, stagger }) {
	const price = getPrice(plan, interval);
	const monthlyCost = interval === "year" ? price / 12 : price;
	const isCurrent = action === "current";
	const Card = href ? "div" : "form";

	return (
		<Card
			{...(!href && { action: choosePlan })}
			style={{ "--stagger": stagger }}
			className={cn(
				"flex flex-col rounded-2xl bg-card p-5 shadow-border animate-enter",
				isCurrent && "ring-2 ring-foreground/80"
			)}
		>
			{!href && (
				<>
					<input type="hidden" name="plan" value={plan.id} />
					<input type="hidden" name="interval" value={interval} />
				</>
			)}
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-medium">{plan.name}</h3>
				{isCurrent && (
					<span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">Current</span>
				)}
			</div>
			<p className="mt-4 flex items-baseline gap-1 tabular-nums">
				<span className="text-4xl font-semibold tracking-tight">{formatUsd(price)}</span>
				<span className="text-sm text-muted-foreground">/{interval === "year" ? "year" : "month"}</span>
			</p>
			<p className="mt-1 h-4 text-xs text-muted-foreground tabular-nums">
				{interval === "year" ? `${cents.format(monthlyCost)} a month, billed yearly` : ""}
			</p>
			<ul className="mt-5 flex flex-col gap-2.5 border-t border-border/60 pt-5 text-sm">
				<li className="flex items-center gap-2.5">
					<Send className="size-4 shrink-0 text-muted-foreground" />
					<span className="tabular-nums">
						<span className="font-medium">{formatNumber(plan.emailsPerMonth)}</span> emails a month
					</span>
				</li>
				<li className="flex items-center gap-2.5">
					<Users className="size-4 shrink-0 text-muted-foreground" />
					<span className="tabular-nums">
						<span className="font-medium">{formatNumber(plan.subscribers)}</span> subscribers
					</span>
				</li>
			</ul>
			{href ? (
				<Button asChild className="mt-5 w-full">
					<a href={href} rel="nofollow">
						{BUTTON_LABELS.subscribe}
					</a>
				</Button>
			) : (
				<Button type="submit" variant={isCurrent ? "outline" : "default"} disabled={isCurrent} className="mt-5 w-full">
					{BUTTON_LABELS[action]}
				</Button>
			)}
		</Card>
	);
}

const BUTTON_LABELS = {
	subscribe: "Subscribe",
	switch: "Switch",
	current: "Current plan",
};
