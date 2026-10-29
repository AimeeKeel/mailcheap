"use server";

import { runDashboardAction, toFormError } from "@/lib/actions/dashboard";

// The bell in the sidebar and the phone's top bar (components/ProviderNotifications.jsx), on every dashboard page, so in
// a route group of its own: a page of notifications, then the older ones from cursor.
export async function getNotifications(cursor) {
	const { output, failure } = await runDashboardAction("list_notifications", cursor ? { cursor: String(cursor) } : {});
	if (failure) return toFormError(failure);
	return output;
}

// The ones the tray showed, once it opens.
export async function markNotificationsRead(ids) {
	const { output, failure } = await runDashboardAction("mark_notifications_read", {
		ids: Array.isArray(ids) ? ids.slice(0, 100).map(String) : [],
	});
	if (failure) return toFormError(failure);
	return output;
}
