"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addContact } from "@/app/(app)/contacts/actions";
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
import { Input } from "@/components/ui/input";
import { ERROR_CODES } from "@/lib/account-state";
import { usePaywall } from "@/lib/use-paywall";

// Into the newsletter the page shows.
export default function DialogAddContact({ newsletter, variant = "outline", size }) {
	const [isOpen, setIsOpen] = useState(false);
	const [formKey, setFormKey] = useState(0);

	function changeOpen(open) {
		setIsOpen(open);
		if (!open) setFormKey((key) => key + 1);
	}

	return (
		<Dialog open={isOpen} onOpenChange={changeOpen}>
			<DialogTrigger asChild>
				<Button variant={variant} size={size} disabled={!newsletter}>
					<Plus data-icon="inline-start" />
					Add contact
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<FormContact key={formKey} newsletter={newsletter} onClose={() => changeOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}

function FormContact({ newsletter, onClose }) {
	const paywall = usePaywall();
	const [email, setEmail] = useState("");
	const [state, action, isPending] = useActionState(async (previous, formData) => {
		const result = await addContact(previous, formData);
		if (result?.code === ERROR_CODES.subscriptionRequired && paywall) {
			onClose();
			paywall.open("contact");
		} else if (!result?.error) {
			onClose();
			toast.success(getAddedMessage(result, paywall?.hasPlan ?? true));
		}
		return result;
	}, null);

	return (
		<form action={action} className="flex flex-col gap-4">
			<DialogHeader>
				<DialogTitle>Add a contact</DialogTitle>
				<DialogDescription>
					To <span className="font-medium text-foreground">{newsletter?.name}</span>. Only add people who agreed to get your
					emails.
				</DialogDescription>
			</DialogHeader>
			<input type="hidden" name="newsletterId" value={newsletter?.id ?? ""} />
			<Input
				type="email"
				name="email"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				placeholder="Email, e.g. jane@example.com"
				aria-label="Email"
				required
				autoFocus
				maxLength={320}
				autoComplete="email"
				spellCheck={false}
			/>
			{state?.error && <p className="text-sm text-destructive">{state.error}</p>}
			<DialogFooter>
				<Button type="submit" disabled={isPending} className="min-w-20">
					{isPending ? <Loader2 className="animate-spin" /> : "Add"}
				</Button>
			</DialogFooter>
		</form>
	);
}

function getAddedMessage({ email, status }, hasPlan) {
	if (status === "active") return `${email} added`;
	if (status === "pending") return `${email} added, pending until they confirm${hasPlan ? "" : ". Confirmation emails need a plan."}`;
	return `${email} added as ${status}`;
}
