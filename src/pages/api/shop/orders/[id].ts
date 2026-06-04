import type { APIRoute } from "astro";
import { z } from "zod";
import { getSession } from "../../../../lib/session";
import { updateShopOrderStatus } from "../../../../lib/airtable";

const UpdateSchema = z.object({
	status: z.enum(["submitted", "fulfilled"]),
});

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not authenticated" }, { status: 401 });
	}

	const adminIds = (import.meta.env.ADMIN_IDS ?? "")
		.split(",")
		.map((s: string) => s.trim())
		.filter(Boolean);
	if (!adminIds.includes(session.slack_id)) {
		return Response.json({ error: "Not authorized" }, { status: 403 });
	}

	const orderId = params.id;
	if (!orderId) {
		return Response.json({ error: "Missing order ID" }, { status: 400 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const parsed = UpdateSchema.safeParse(body);
	if (!parsed.success) {
		return Response.json(
			{ error: "status must be 'submitted' or 'fulfilled'" },
			{ status: 400 },
		);
	}

	const ok = await updateShopOrderStatus(orderId, parsed.data.status);
	if (!ok) {
		return Response.json({ error: "Failed to update order" }, { status: 500 });
	}

	return Response.json({ success: true });
};
