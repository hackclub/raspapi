import type { APIRoute } from "astro";
import { z } from "zod";
import { getSession } from "../../../lib/session";
import {
	getUserBySlackId,
	getShopItemById,
	createShopOrder,
	createShopLedgerEntry,
} from "../../../lib/airtable";

const BuySchema = z.object({
	item_id: z.string().min(1),
});

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not authenticated" }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const parsed = BuySchema.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: "item_id is required" }, { status: 400 });
	}

	const { item_id } = parsed.data;

	const user = await getUserBySlackId(session.slack_id);
	if (!user) {
		return Response.json({ error: "User not found" }, { status: 404 });
	}

	const item = await getShopItemById(item_id);
	if (!item) {
		return Response.json({ error: "Item not found" }, { status: 404 });
	}

	if (user.balance < item.price) {
		return Response.json(
			{
				error: "Insufficient balance",
				balance: user.balance,
				price: item.price,
			},
			{ status: 400 },
		);
	}

	const ledgerEntryId = await createShopLedgerEntry(
		user.id,
		item_id,
		`Shop purchase: ${item.name}`,
	);
	if (!ledgerEntryId) {
		return Response.json(
			{ error: "Failed to create ledger entry" },
			{ status: 500 },
		);
	}

	const order = await createShopOrder(user.id, item_id);
	if (!order) {
		return Response.json({ error: "Failed to create order" }, { status: 500 });
	}

	return Response.json(
		{
			success: true,
			order_id: order.id,
			new_balance: user.balance - item.price,
		},
		{ status: 201 },
	);
};
