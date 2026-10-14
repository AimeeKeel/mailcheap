import Link from "next/link";
import { YEARLY_MONTHS } from "@/lib/plans";
import { cn } from "@/lib/utils";

// The billing page reads the interval from ?interval=, so the toggle needs no client code.
export default function TabsInterval({ interval }) {
	return (
		<nav aria-label="Billing interval" className="inline-flex items-center gap-1 rounded-xl bg-muted/70 p-1">
			{INTERVAL_TABS.map(({ value, label, note }) => {
				const isSelected = value === interval;
				return (
					<Link
						key={value}
						href={`/billing?interval=${value}`}
						scroll={false}
						replace
						aria-current={isSelected ? "page" : undefined}
						className={cn(
							"flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150",
							isSelected
								? "bg-background text-foreground shadow-border dark:bg-muted"
								: "text-muted-foreground hover:text-foreground"
						)}
					>
						{label}
						{note && <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">{note}</span>}
					</Link>
				);
			})}
		</nav>
	);
}

export const INTERVAL_TABS = [
	{ value: "month", label: "Monthly" },
	{ value: "year", label: "Yearly", note: `${12 - YEARLY_MONTHS} months free` },
];
