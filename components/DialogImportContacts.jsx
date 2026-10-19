"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, Loader2, Upload } from "lucide-react";
import Papa from "papaparse";
import { createContactField, importContacts } from "@/app/(app)/contacts/actions";
import InputTags from "@/components/InputTags";
import { useContactOptions } from "@/components/ProviderContactOptions";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_TYPES, cleanTags, fieldKeyFromLabel } from "@/lib/contact-fields";
import {
	MAX_IMPORT_ROWS_PER_REQUEST,
	canBeNewField,
	guessFieldType,
	labelFromColumn,
	mapColumns,
	normalizeImportRow,
	suggestProfileColumns,
} from "@/lib/csv-import";
import { CONSENT_TEXT, DROP_REASONS, addDropped } from "@/lib/import-checks";
import { formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Into the newsletter the page shows.
export default function DialogImportContacts({ newsletter, label = "Import", variant = "outline" }) {
	const router = useRouter();
	const { fields, tags: tagOptions } = useContactOptions();
	const [isOpen, setIsOpen] = useState(false);
	const [mode, setMode] = useState("file");
	const [file, setFile] = useState(null);
	const [parsed, setParsed] = useState(null);
	// The columns the import doesn't read on its own, each into "first_name", "tags", "field:<key>", "new:<type>" or "skip".
	const [extraColumns, setExtraColumns] = useState([]);
	const [importTags, setImportTags] = useState([]);
	const [progress, setProgress] = useState(null);
	const [hasConsent, setHasConsent] = useState(false);
	const [summary, setSummary] = useState(null);
	const [isImporting, startImporting] = useTransition();
	const profile = useMemo(() => getProfileColumns(extraColumns, fields), [extraColumns, fields]);

	// Invalid rows still go to the server, which checks every row again and counts them in the import.
	const { rows, invalidRows, duplicates } = useMemo(() => {
		if (!parsed) return { rows: [], invalidRows: [], duplicates: 0 };
		const options = { ...(mode === "dormant" && { status: "dormant" }), profile };
		const byEmail = new Map();
		const invalid = [];
		for (const row of parsed.rows) {
			const normalized = normalizeImportRow(row, parsed.columns, options);
			if (!normalized)
				invalid.push({ email: String(row[parsed.columns.email] ?? "").slice(0, 254), status: "active" });
			else if (!byEmail.has(normalized.email)) byEmail.set(normalized.email, withTags(normalized, importTags));
		}
		return {
			rows: [...byEmail.values()],
			invalidRows: invalid,
			duplicates: parsed.rows.length - invalid.length - byEmail.size,
		};
	}, [parsed, mode, profile, importTags]);
	const statusCounts = useMemo(
		() =>
			Object.entries(Object.groupBy(rows, ({ status }) => status)).map(([status, group]) => [
				status,
				group.length,
			]),
		[rows],
	);

	function reset() {
		setFile(null);
		setParsed(null);
		setExtraColumns([]);
		setImportTags([]);
		setProgress(null);
		setHasConsent(false);
		setSummary(null);
	}

	function onFileChange(event) {
		const selected = event.target.files?.[0];
		if (!selected) return;
		setFile(selected);
		Papa.parse(selected, {
			header: true,
			skipEmptyLines: true,
			complete: ({ data, meta }) => {
				const headers = meta.fields ?? [];
				const columns = mapColumns(headers);
				if (!columns.email) {
					toast.error("No email column found");
					return reset();
				}
				setParsed({ rows: data, columns });
				setExtraColumns(
					suggestProfileColumns(headers, fields, data).map((item) => ({
						...item,
						newType: guessFieldType(data.map((row) => row[item.column])),
					}))
				);
			},
			error: () => toast.error("Could not read this file"),
		});
	}

	// One column for the first name and one for tags: picking another moves it.
	function mapColumn(column, target) {
		setExtraColumns((current) =>
			current.map((item) => {
				if (item.column === column) return { ...item, target };
				return (target === "first_name" || target === "tags") && item.target === target ? { ...item, target: "skip" } : item;
			})
		);
	}

	// Fields made from columns come first, so the rows' values for them are kept.
	async function createNewFields() {
		for (const { column, target } of extraColumns.filter((item) => item.target.startsWith("new:"))) {
			const result = await createContactField({ label: labelFromColumn(column), type: target.slice("new:".length) });
			if (result?.error && !result.error.startsWith("There's already")) return result.error;
		}
		return null;
	}

	function runImport() {
		startImporting(async () => {
			const fieldProblem = await createNewFields();
			if (fieldProblem) return void toast.error(fieldProblem);
			const allRows = [...rows, ...invalidRows];
			const totals = { created: 0, existing: 0, dropped: {} };
			let importId;
			for (let start = 0; start < allRows.length; start += MAX_IMPORT_ROWS_PER_REQUEST) {
				setProgress(start / allRows.length);
				const result = await importContacts({
					newsletterId: newsletter.id,
					consent: hasConsent,
					importId,
					duplicates: importId ? 0 : duplicates,
					rows: allRows.slice(start, start + MAX_IMPORT_ROWS_PER_REQUEST),
				});
				if (result?.error) {
					toast.error(result.error);
					return setProgress(null);
				}
				importId = result.importId;
				totals.created += result.created;
				totals.existing += result.existing;
				totals.dropped = addDropped(totals.dropped, result.dropped);
			}
			setProgress(null);
			setSummary(totals);
			router.refresh();
		});
	}

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (isImporting) return;
				setIsOpen(open);
				if (!open) reset();
			}}
		>
			<DialogTrigger asChild>
				<Button variant={variant} disabled={!newsletter}>
					<Upload data-icon="inline-start" />
					{label}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Import contacts</DialogTitle>
					<DialogDescription>
						Into <span className="font-medium text-foreground">{newsletter?.name}</span>. A CSV with an email column:
						exports from beehiiv, Substack, Mailchimp, Kit and other platforms work as they are. Existing contacts keep
						their status.
					</DialogDescription>
				</DialogHeader>

				{summary ? (
					<SummaryImport summary={summary} />
				) : (
					<div className="flex flex-col gap-3">
						<Select value={mode} onValueChange={setMode} disabled={isImporting}>
							<SelectTrigger className="h-9 w-full" aria-label="Status">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="file">Status from file</SelectItem>
								<SelectItem value="dormant">Import as dormant</SelectItem>
							</SelectContent>
						</Select>

						<label
							className={cn(
								"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-4 py-8 text-center shadow-border transition-[box-shadow,background-color] duration-150 hover:bg-muted/40 hover:shadow-border-hover",
								isImporting && "pointer-events-none opacity-60",
							)}
						>
							<FileUp className="size-5 text-muted-foreground" />
							<span className="max-w-full truncate text-sm font-medium">
								{file ? file.name : "Choose a CSV file"}
							</span>
							{parsed && (
								<span className="text-xs text-muted-foreground tabular-nums">
									{formatNumber(rows.length)} unique valid of {formatNumber(parsed.rows.length)} rows
								</span>
							)}
							<input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileChange} />
						</label>

						{statusCounts.length > 0 && (
							<div className="flex flex-wrap gap-1.5">
								{statusCounts.map(([status, count]) => (
									<span
										key={status}
										className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground tabular-nums"
									>
										{status} <span className="text-foreground">{formatNumber(count)}</span>
									</span>
								))}
							</div>
						)}

						{extraColumns.length > 0 && (
							<div className="flex flex-col gap-1.5">
								<span className="text-sm font-medium">Other columns</span>
								<span className="text-xs text-muted-foreground">
									Skip leaves a column out. Pick one of your fields or a new field to keep its values.
								</span>
								<ul className="flex max-h-52 flex-col divide-y divide-border/60 overflow-y-auto rounded-xl shadow-border">
									{extraColumns.map((item) => (
										<RowColumn
											key={item.column}
											item={item}
											fields={fields}
											columns={extraColumns}
											isDisabled={isImporting}
											onChange={mapColumn}
										/>
									))}
								</ul>
							</div>
						)}

						{parsed && (
							<div className="flex flex-col gap-1.5">
								<span className="text-sm font-medium">Tag everyone in this import</span>
								<InputTags
									value={importTags}
									onChange={setImportTags}
									suggestions={tagOptions.map(({ name }) => name)}
									max={10}
									placeholder="Optional, e.g. from-substack"
								/>
							</div>
						)}

						<label className="flex items-start gap-2.5 text-sm">
							<input
								type="checkbox"
								checked={hasConsent}
								onChange={(event) => setHasConsent(event.target.checked)}
								disabled={isImporting}
								className="mt-0.5 size-4 shrink-0 accent-foreground"
							/>
							<span>
								{CONSENT_TEXT}
								<span className="block text-xs text-muted-foreground">
									Role addresses, throwaway inboxes and addresses that bounced or complained are left out.
								</span>
							</span>
						</label>

						{progress !== null && (
							<div className="h-1.5 overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-foreground transition-[width] duration-300"
									style={{ width: `${Math.max(progress, 0.02) * 100}%` }}
								/>
							</div>
						)}
					</div>
				)}

				<DialogFooter>
					{summary ? (
						<Button
							onClick={() => {
								setIsOpen(false);
								reset();
							}}
							className="min-w-24"
						>
							Done
						</Button>
					) : (
						<Button
							onClick={runImport}
							disabled={!newsletter || rows.length === 0 || !hasConsent || isImporting}
							className="min-w-24"
						>
							{isImporting ? (
								<Loader2 className="animate-spin" />
							) : (
								`Import ${rows.length ? formatNumber(rows.length) : ""}`.trim()
							)}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// A column of the file and where it goes. A new field takes the column's name, as a type guessed from its values.
function RowColumn({ item, fields, columns, isDisabled, onChange }) {
	const isNewFieldAllowed = canBeNewField(item, columns, fields);
	return (
		<li className="flex items-center gap-2 py-1.5 pr-1.5 pl-3">
			<span className="min-w-0 flex-1 truncate text-sm">{item.column}</span>
			<ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<Select value={item.target} onValueChange={(target) => onChange(item.column, target)} disabled={isDisabled}>
				<SelectTrigger size="sm" className="w-40 shrink-0" aria-label={`Where ${item.column} goes`}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent align="end">
					<SelectItem value="skip">Skip</SelectItem>
					<SelectItem value="first_name">First name</SelectItem>
					<SelectItem value="tags">Tags</SelectItem>
					{(fields.length > 0 || isNewFieldAllowed) && <SelectSeparator />}
					{fields.map(({ key, label }) => (
						<SelectItem key={key} value={`field:${key}`}>
							{label}
						</SelectItem>
					))}
					{isNewFieldAllowed && <SelectItem value={`new:${item.newType}`}>New {FIELD_TYPES[item.newType].label.toLowerCase()} field</SelectItem>}
				</SelectContent>
			</Select>
		</li>
	);
}

// What normalizeImportRow reads into each contact: { firstName: column, tags: column, fields: [{ column, key, type }] }.
function getProfileColumns(extraColumns, fields) {
	const columnFor = (target) => extraColumns.find((item) => item.target === target)?.column;
	return {
		firstName: columnFor("first_name"),
		tags: columnFor("tags"),
		fields: extraColumns.flatMap(({ column, target }) => {
			if (target.startsWith("new:")) return [{ column, key: fieldKeyFromLabel(column), type: target.slice("new:".length) }];
			const field = target.startsWith("field:") && fields.find(({ key }) => key === target.slice("field:".length));
			return field ? [{ column, key: field.key, type: field.type }] : [];
		}),
	};
}

function withTags(row, tags) {
	if (tags.length === 0) return row;
	return { ...row, tags: cleanTags([...(row.tags ?? []), ...tags]) };
}

function SummaryImport({ summary }) {
	const dropped = Object.entries(summary.dropped).filter(([, count]) => count > 0);
	return (
		<div className="flex flex-col gap-3 text-sm">
			<p>
				<span className="font-medium tabular-nums">{formatNumber(summary.created)}</span> added,{" "}
				<span className="font-medium tabular-nums">{formatNumber(summary.existing)}</span> already there.
			</p>
			{dropped.length > 0 ? (
				<div className="rounded-xl px-4 py-3 shadow-border">
					<p className="mb-2 font-medium">
						{formatNumber(dropped.reduce((sum, [, count]) => sum + count, 0))} left out
					</p>
					<ul className="flex flex-col gap-1 text-muted-foreground">
						{dropped.map(([reason, count]) => (
							<li key={reason} className="flex justify-between gap-4">
								<span>{DROP_REASONS[reason]}</span>
								<span className="text-foreground tabular-nums">{formatNumber(count)}</span>
							</li>
						))}
					</ul>
				</div>
			) : (
				<p className="text-muted-foreground">Nothing left out.</p>
			)}
		</div>
	);
}
