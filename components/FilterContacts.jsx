"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InputSearch from "@/components/InputSearch";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

const ALL_TAGS = "__all";

// The search by address and, once contacts have tags, a filter by tag. tags: [{ name, contacts }], most used first.
export default function FilterContacts({ tags = [] }) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [query, setQuery] = useState(searchParams.get("q") ?? "");
	const [isPending, startTransition] = useTransition();
	const timeout = useRef(null);
	const tag = searchParams.get("tag") ?? "";

	function navigate(changes) {
		const params = new URLSearchParams(searchParams);
		for (const [key, value] of Object.entries(changes)) {
			if (value) params.set(key, value);
			else params.delete(key);
		}
		params.delete("page");
		startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
	}

	function onQueryChange(value) {
		setQuery(value);
		clearTimeout(timeout.current);
		const q = value.trim();
		if (q) timeout.current = setTimeout(() => navigate({ q }), 300);
		else navigate({ q });
	}

	useEffect(() => () => clearTimeout(timeout.current), []);

	return (
		<div className="flex min-w-0 flex-1 gap-2">
			<InputSearch
				value={query}
				onChange={onQueryChange}
				isPending={isPending}
				placeholder="Search by email or domain"
				aria-label="Search by email or domain"
				className="flex-1"
			/>
			{(tags.length > 0 || tag) && (
				<Select value={tag || ALL_TAGS} onValueChange={(value) => navigate({ tag: value === ALL_TAGS ? "" : value })}>
					<SelectTrigger className="h-9 w-36 shrink-0 sm:w-44" aria-label="Tag">
						{/* The name alone: the items also show their counts. */}
						<SelectValue>{tag ? <span className="truncate">{tag}</span> : <span className="text-muted-foreground">All tags</span>}</SelectValue>
					</SelectTrigger>
					<SelectContent align="end">
						<SelectItem value={ALL_TAGS}>All tags</SelectItem>
						<SelectSeparator />
						{tag && !tags.some(({ name }) => name === tag) && <SelectItem value={tag}>{tag}</SelectItem>}
						{tags.map(({ name, contacts }) => (
							<SelectItem key={name} value={name}>
								<span className="flex w-full items-center justify-between gap-3">
									<span className="truncate">{name}</span>
									<span className="text-xs text-muted-foreground tabular-nums">{formatNumber(contacts)}</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</div>
	);
}
