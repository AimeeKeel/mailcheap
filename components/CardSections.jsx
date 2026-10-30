"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Globe, Mail, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import CardSettings from "@/components/CardSettings";
import { formatCount } from "@/lib/format";
import { SECTION_PLACE_LABELS, describeSectionReaders, formatSectionGroup, listSections } from "@/lib/sections";
import { cn } from "@/lib/utils";

// The review step's sections (lib/sections.js), in the issue's order: who sees each and where, and how many of the
// readers the issue goes to get it in their email. A web-only issue's sections only show on its page or don't.
export default function CardSections({ body, segments, countReaders, isWebOnly = false, onPreview }) {
	const rules = useMemo(() => listSections(body), [body]);
	const keys = useMemo(
		() => [...new Set(rules.filter((rule) => rule?.group && rule.place !== "web").map((rule) => formatSectionGroup(rule.group)))],
		[rules]
	);
	const [counts, setCounts] = useState({});

	// Each tag or segment counted once while the issue names it, and again on the next visit to the step.
	useEffect(() => {
		if (isWebOnly) return;
		let isCurrent = true;
		for (const key of keys) {
			countReaders(key).then((result) => isCurrent && setCounts((current) => ({ ...current, [key]: result ?? { isMissing: true } })));
		}
		return () => {
			isCurrent = false;
		};
	}, [keys, countReaders, isWebOnly]);

	return (
		<CardSettings
			title="Sections"
			stagger={1}
			action={
				<Button variant="ghost" size="sm" onClick={onPreview} className="-mr-2 text-muted-foreground">
					<Eye data-icon="inline-start" />
					Preview as a reader
				</Button>
			}
		>
			{rules.map((rule, index) => {
				const place = rule?.place ?? "both";
				const Icon = place === "email" ? Mail : place === "web" ? Globe : UsersRound;
				const isDeleted = rule?.group?.kind === "segment" && !segments.some(({ id }) => id === rule.group.value);
				return (
					<div key={index} className="flex items-center gap-3 px-4 py-3">
						<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
							<Icon className="size-4" aria-hidden="true" />
						</span>
						<span className="min-w-0 flex-1">
							<span className={cn("block truncate text-sm font-medium", (!rule || isDeleted) && "text-destructive")}>
								{rule ? describeSectionReaders(rule, segments) : "Pick who sees this section"}
							</span>
							<span className="block truncate text-xs text-muted-foreground">{SECTION_PLACE_LABELS[place]}</span>
						</span>
						<span className="shrink-0 text-right text-sm text-muted-foreground tabular-nums">
							{describeReach({ rule, isDeleted, isWebOnly, count: rule?.group ? counts[formatSectionGroup(rule.group)] : null })}
						</span>
					</div>
				);
			})}
		</CardSettings>
	);
}

// How many get the section: in their email, or for a web-only issue, whether its page shows it.
function describeReach({ rule, isDeleted, isWebOnly, count }) {
	if (!rule) return "Nobody";
	if (isWebOnly) return rule.place === "email" ? "Not on the page" : "Every visitor";
	if (rule.place === "web") return "Every visitor";
	if (isDeleted) return "Segment deleted";
	if (!rule.group) return "Everyone";
	if (!count) return "…";
	if (count.isMissing) return "";
	return formatCount(rule.isExcept ? count.readers - count.count : count.count, "reader");
}
