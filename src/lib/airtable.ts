import { uploadToCDN } from "./cdn";

const BASE = () =>
	`https://api.airtable.com/v0/${import.meta.env.AIRTABLE_BASE_ID}`;
const HEADERS = () => ({
	Authorization: `Bearer ${import.meta.env.AIRTABLE_API_KEY}`,
	"Content-Type": "application/json",
});

export interface UserRecord {
	id: string;
	slack_id: string;
	hackatime_token?: string;
	balance: number;
	row_number?: number;
	referer?: number;
	first_name?: string;
	last_name?: string;
	legal_first_name?: string;
	legal_last_name?: string;
	email?: string;
	birthday?: string;
	address_line_1?: string;
	address_line_2?: string;
	address_city?: string;
	address_state?: string;
	address_postal_code?: string;
	address_country?: string;
}

export interface IdentityFields {
	first_name?: string;
	last_name?: string;
	legal_first_name?: string;
	legal_last_name?: string;
	email?: string;
	birthday?: string;
	address_line_1?: string;
	address_line_2?: string;
	address_city?: string;
	address_state?: string;
	address_postal_code?: string;
	address_country?: string;
}

export interface ProjectRecord {
	id: string;
	name: string;
	user_slack_id: string;
	project_url?: string;
	repo_url?: string;
	image_url?: string;
	description: string;
	hackatime_project?: string;
	has_pending_submission: boolean;
	hours_cached?: number;
	hours_updated_at?: number;
	approved_hours: number;
}

export interface SubmissionRecord {
	id: string;
	project_id: string;
	hours_at_submission: number;
	approved_hours: number;
	review_status: "submitted" | "rejected" | "approved";
	reviewer_notes: string;
	override_hours_justification: string;
	multiplier: number;
	payout: number;
	payout_transaction_id?: string;
}

function parseUserRecord(r: {
	id: string;
	fields: Record<string, unknown>;
}): UserRecord {
	return {
		id: r.id,
		slack_id: r.fields.slack_id as string,
		hackatime_token: (r.fields.hackatime_token as string) ?? undefined,
		balance: (r.fields.balance as number) ?? 0,
		row_number: (r.fields.row_number as number) ?? undefined,
		referer: (r.fields.referer as number) ?? undefined,
		first_name: (r.fields.first_name as string) ?? undefined,
		last_name: (r.fields.last_name as string) ?? undefined,
		legal_first_name: (r.fields.legal_first_name as string) ?? undefined,
		legal_last_name: (r.fields.legal_last_name as string) ?? undefined,
		email: (r.fields.email as string) ?? undefined,
		birthday: (r.fields.birthday as string) ?? undefined,
		address_line_1: (r.fields.address_line_1 as string) ?? undefined,
		address_line_2: (r.fields.address_line_2 as string) ?? undefined,
		address_city: (r.fields.address_city as string) ?? undefined,
		address_state: (r.fields.address_state as string) ?? undefined,
		address_postal_code: (r.fields.address_postal_code as string) ?? undefined,
		address_country: (r.fields.address_country as string) ?? undefined,
	};
}

export async function upsertUser(
	slack_id: string,
	identity?: IdentityFields,
	referer?: number,
): Promise<UserRecord | null> {
	const filter = encodeURIComponent(`{slack_id}="${slack_id}"`);
	const findRes = await fetch(
		`${BASE()}/users?filterByFormula=${filter}&maxRecords=1`,
		{ headers: HEADERS() },
	);
	if (findRes.ok) {
		const data = await findRes.json();
		if (data.records?.length > 0) {
			const r = data.records[0];
			if (identity) {
				const patchRes = await fetch(`${BASE()}/users/${r.id}`, {
					method: "PATCH",
					headers: HEADERS(),
					body: JSON.stringify({ fields: identity }),
				});
				if (!patchRes.ok) {
					console.error(
						"[upsertUser] Failed to update identity",
						r.id,
						patchRes.status,
					);
				}
			}
			return parseUserRecord(r);
		}
	}

	const fields: Record<string, unknown> = { slack_id, ...identity };
	if (referer !== undefined) fields.referer = referer;

	const createRes = await fetch(`${BASE()}/users`, {
		method: "POST",
		headers: HEADERS(),
		body: JSON.stringify({ records: [{ fields }] }),
	});
	if (!createRes.ok) return null;
	const created = await createRes.json();
	const r = created.records?.[0];
	if (!r) return null;
	return parseUserRecord(r);
}

export async function getUserBySlackId(
	slack_id: string,
): Promise<UserRecord | null> {
	const filter = encodeURIComponent(`{slack_id}="${slack_id}"`);
	const res = await fetch(
		`${BASE()}/users?filterByFormula=${filter}&maxRecords=1`,
		{ headers: HEADERS() },
	);
	if (!res.ok) return null;
	const data = await res.json();
	if (!data.records?.length) return null;
	return parseUserRecord(data.records[0]);
}

export async function updateHackatimeToken(
	slack_id: string,
	token: string,
): Promise<boolean> {
	const user = await getUserBySlackId(slack_id);
	if (!user) return false;
	const res = await fetch(`${BASE()}/users/${user.id}`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify({ fields: { hackatime_token: token } }),
	});
	return res.ok;
}

export async function getAllUsers(): Promise<UserRecord[]> {
	const records: UserRecord[] = [];
	let offset: string | undefined;

	do {
		const url = new URL(`${BASE()}/users`);
		if (offset) url.searchParams.set("offset", offset);
		const res = await fetch(url.toString(), { headers: HEADERS() });
		if (!res.ok) break;
		const data = await res.json();
		for (const r of data.records ?? []) {
			records.push(parseUserRecord(r));
		}
		offset = data.offset;
	} while (offset);

	return records;
}

export async function getProjectById(
	id: string,
): Promise<ProjectRecord | null> {
	const res = await fetch(`${BASE()}/projects/${id}`, { headers: HEADERS() });
	if (!res.ok) return null;
	const r = await res.json();
	return {
		id: r.id,
		name: r.fields.name ?? "",
		user_slack_id: r.fields.user_slack_id[0],
		project_url: r.fields.project_url ?? undefined,
		repo_url: r.fields.repo_url ?? undefined,
		image_url: r.fields.image?.[0].url ?? undefined,
		description: r.fields.description ?? "",
		hackatime_project: r.fields.hackatime_project ?? undefined,
		has_pending_submission: r.fields.has_pending_submission ?? false,
		hours_cached: r.fields.hours_cached ?? undefined,
		hours_updated_at: r.fields.hours_updated_at ?? undefined,
		approved_hours: r.fields.approved_hours ?? 0,
	};
}

export async function getAllProjectsBySlackId(
	slack_id: string,
): Promise<ProjectRecord[]> {
	const records: ProjectRecord[] = [];
	const filter = encodeURIComponent(`{user_slack_id}="${slack_id}"`);
	let offset: string | undefined;

	do {
		const url = new URL(`${BASE()}/projects?filterByFormula=${filter}`);
		if (offset) url.searchParams.set("offset", offset);
		const res = await fetch(url.toString(), { headers: HEADERS() });
		if (!res.ok) break;
		const data = await res.json();
		for (const r of data.records ?? []) {
			records.push({
				id: r.id,
				name: r.fields.name ?? "",
				user_slack_id: r.fields.user_slack_id[0],
				project_url: r.fields.project_url ?? undefined,
				repo_url: r.fields.repo_url ?? undefined,
				image_url: r.fields.image?.[0]?.url ?? undefined,
				description: r.fields.description ?? "",
				hackatime_project: r.fields.hackatime_project ?? undefined,
				has_pending_submission: r.fields.has_pending_submission ?? false,
				hours_cached: r.fields.hours_cached ?? undefined,
				hours_updated_at: r.fields.hours_updated_at ?? undefined,
				approved_hours: r.fields.approved_hours ?? 0,
			});
		}
		offset = data.offset;
	} while (offset);

	return records;
}

export async function createProject(
	user_id: string,
	name: string,
): Promise<ProjectRecord | null> {
	const res = await fetch(`${BASE()}/projects`, {
		method: "POST",
		headers: HEADERS(),
		body: JSON.stringify({
			records: [{ fields: { name, user: [user_id] } }],
		}),
	});
	if (!res.ok) return null;
	const created = await res.json();
	const r = created.records?.[0];
	if (!r) return null;
	return {
		id: r.id,
		name: r.fields.name ?? "",
		user_slack_id: r.fields.user_slack_id[0],
		description: r.fields.description ?? "",
		has_pending_submission: r.fields.has_pending_submission ?? false,
		approved_hours: 0,
	};
}

export async function updateProject(
	id: string,
	data: {
		name?: string;
		project_url?: string | null;
		repo_url?: string | null;
		description?: string;
		hackatime_project?: string | null;
	},
): Promise<ProjectRecord | null> {
	const fields: Record<string, unknown> = {
		name: data.name,
		project_url: data.project_url,
		repo_url: data.repo_url,
		description: data.description,
		hackatime_project: data.hackatime_project,
	};

	const res = await fetch(`${BASE()}/projects`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify({ records: [{ id, fields }] }),
	});
	if (!res.ok) return null;
	const updated = await res.json();
	const r = updated.records?.[0];
	if (!r) return null;
	return {
		id: r.id,
		name: r.fields.name ?? "",
		user_slack_id: r.fields.user_slack_id[0],
		project_url: r.fields.project_url ?? undefined,
		repo_url: r.fields.repo_url ?? undefined,
		description: r.fields.description ?? "",
		hackatime_project: r.fields.hackatime_project ?? undefined,
		has_pending_submission: r.fields.has_pending_submission ?? false,
		approved_hours: r.fields.approved_hours ?? 0,
	};
}

export async function updateProjectHoursCache(
	id: string,
	hours_cached: number,
	hours_updated_at: number,
): Promise<boolean> {
	const res = await fetch(`${BASE()}/projects`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify({
			records: [{ id, fields: { hours_cached, hours_updated_at } }],
		}),
	});
	return res.ok;
}

export async function deleteProject(id: string): Promise<boolean> {
	const res = await fetch(`${BASE()}/projects/${id}`, {
		method: "DELETE",
		headers: HEADERS(),
	});
	return res.ok;
}

export async function updateProjectImage(id: string, image: Blob) {
	const url = await uploadToCDN(image);
	if (!url) return false;

	const res = await fetch(`${BASE()}/projects`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify({ records: [{ id, fields: { image: [{ url }] } }] }),
	});
	return res.ok;
}

export async function createSubmission(
	projectId: string,
	hours: number,
): Promise<SubmissionRecord | null> {
	const res = await fetch(`${BASE()}/submissions`, {
		method: "POST",
		headers: HEADERS(),
		body: JSON.stringify({
			records: [
				{ fields: { project: [projectId], hours_at_submission: hours } },
			],
		}),
	});
	if (!res.ok) return null;
	const created = await res.json();
	const r = created.records?.[0];
	if (!r) return null;
	return {
		id: r.id,
		project_id: r.fields.project[0],
		hours_at_submission: r.fields.hours_at_submission ?? 0,
		approved_hours: r.fields.approved_hours ?? 0,
		review_status: r.fields.review_status,
		reviewer_notes: r.fields.reviewer_notes ?? "",
		override_hours_justification: r.fields.override_hours_justification ?? "",
		multiplier: r.fields.multiplier ?? 1,
		payout: r.fields.payout ?? 0,
		payout_transaction_id: r.fields.payout_transaction?.[0] ?? undefined,
	};
}

export interface SubmissionWithProject extends SubmissionRecord {
	project_name: string;
	project_description: string;
	project_url?: string;
	repo_url?: string;
	image_url?: string;
	hackatime_project?: string;
	user_slack_id: string;
	created_at: string;
}

export async function getPendingSubmissions(): Promise<
	SubmissionWithProject[]
> {
	const submissions: SubmissionWithProject[] = [];
	const filter = encodeURIComponent(`{review_status}="submitted"`);
	let offset: string | undefined;

	do {
		const url = new URL(
			`${BASE()}/submissions?filterByFormula=${filter}&sort%5B0%5D%5Bfield%5D=id&sort%5B0%5D%5Bdirection%5D=asc`,
		);
		if (offset) url.searchParams.set("offset", offset);
		const res = await fetch(url.toString(), { headers: HEADERS() });
		if (!res.ok) break;
		const data = await res.json();
		for (const r of data.records ?? []) {
			const projectId = r.fields.project?.[0];
			let project: ProjectRecord | null = null;
			if (projectId) {
				project = await getProjectById(projectId);
			}
			submissions.push({
				id: r.id,
				project_id: projectId ?? "",
				hours_at_submission: r.fields.hours_at_submission ?? 0,
				approved_hours: r.fields.approved_hours ?? 0,
				review_status: r.fields.review_status ?? "submitted",
				reviewer_notes: r.fields.reviewer_notes ?? "",
				override_hours_justification:
					r.fields.override_hours_justification ?? "",
				multiplier: r.fields.multiplier ?? 1,
				payout: r.fields.payout ?? 0,
				payout_transaction_id: r.fields.payout_transaction?.[0] ?? undefined,
				project_name: project?.name ?? "",
				project_description: project?.description ?? "",
				project_url: project?.project_url,
				repo_url: project?.repo_url,
				image_url: project?.image_url,
				hackatime_project: project?.hackatime_project,
				user_slack_id: project?.user_slack_id ?? "",
				created_at: r.createdTime ?? "",
			});
		}
		offset = data.offset;
	} while (offset);

	return submissions;
}

export async function getApprovedSubmissions(): Promise<
	SubmissionWithProject[]
> {
	const submissions: SubmissionWithProject[] = [];
	const filter = encodeURIComponent(`{review_status}="approved"`);
	let offset: string | undefined;

	do {
		const url = new URL(
			`${BASE()}/submissions?filterByFormula=${filter}&sort%5B0%5D%5Bfield%5D=id&sort%5B0%5D%5Bdirection%5D=desc`,
		);
		if (offset) url.searchParams.set("offset", offset);
		const res = await fetch(url.toString(), { headers: HEADERS() });
		if (!res.ok) break;
		const data = await res.json();
		for (const r of data.records ?? []) {
			const projectId = r.fields.project?.[0];
			let project: ProjectRecord | null = null;
			if (projectId) {
				project = await getProjectById(projectId);
			}
			submissions.push({
				id: r.id,
				project_id: projectId ?? "",
				hours_at_submission: r.fields.hours_at_submission ?? 0,
				approved_hours: r.fields.approved_hours ?? 0,
				review_status: r.fields.review_status ?? "approved",
				reviewer_notes: r.fields.reviewer_notes ?? "",
				override_hours_justification:
					r.fields.override_hours_justification ?? "",
				multiplier: r.fields.multiplier ?? 1,
				payout: r.fields.payout ?? 0,
				payout_transaction_id: r.fields.payout_transaction?.[0] ?? undefined,
				project_name: project?.name ?? "",
				project_description: project?.description ?? "",
				project_url: project?.project_url,
				repo_url: project?.repo_url,
				image_url: project?.image_url,
				hackatime_project: project?.hackatime_project,
				user_slack_id: project?.user_slack_id ?? "",
				created_at: r.createdTime ?? "",
			});
		}
		offset = data.offset;
	} while (offset);

	return submissions;
}

export async function getSubmissionById(
	id: string,
): Promise<SubmissionWithProject | null> {
	const res = await fetch(`${BASE()}/submissions/${id}`, {
		headers: HEADERS(),
	});
	if (!res.ok) return null;
	const r = await res.json();
	const projectId = r.fields.project?.[0];
	let project: ProjectRecord | null = null;
	if (projectId) {
		project = await getProjectById(projectId);
	}
	return {
		id: r.id,
		project_id: projectId ?? "",
		hours_at_submission: r.fields.hours_at_submission ?? 0,
		approved_hours: r.fields.approved_hours ?? 0,
		review_status: r.fields.review_status ?? "submitted",
		reviewer_notes: r.fields.reviewer_notes ?? "",
		override_hours_justification: r.fields.override_hours_justification ?? "",
		multiplier: r.fields.multiplier ?? 1,
		payout: r.fields.payout ?? 0,
		payout_transaction_id: r.fields.payout_transaction?.[0] ?? undefined,
		project_name: project?.name ?? "",
		project_description: project?.description ?? "",
		project_url: project?.project_url,
		repo_url: project?.repo_url,
		image_url: project?.image_url,
		user_slack_id: project?.user_slack_id ?? "",
		created_at: r.createdTime ?? "",
	};
}

export async function updateSubmissionReview(
	id: string,
	data: {
		review_status: "approved" | "rejected";
		multiplier: number;
		reviewer_notes: string;
		override_hours_justification: string;
		buffs: string;
		approved_hours: number;
	},
): Promise<boolean> {
	const body = {
		fields: {
			review_status: data.review_status,
			multiplier: data.multiplier,
			reviewer_notes: data.reviewer_notes,
			override_hours_justification: data.override_hours_justification,
			buffs: data.buffs,
			approved_hours: data.approved_hours,
		},
	};
	const res = await fetch(`${BASE()}/submissions/${id}`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		console.error("[updateSubmissionReview] Airtable error", res.status, text);
	}
	return res.ok;
}

export async function updateProjectApprovedHours(
	id: string,
	approved_hours: number,
): Promise<boolean> {
	const res = await fetch(`${BASE()}/projects/${id}`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify({ fields: { approved_hours } }),
	});
	return res.ok;
}

export async function createLedgerEntry(
	userAirtableId: string,
	submissionId: string,
	reason: string,
): Promise<string | null> {
	const res = await fetch(`${BASE()}/ledger`, {
		method: "POST",
		headers: HEADERS(),
		body: JSON.stringify({
			records: [
				{
					fields: {
						user: [userAirtableId],
						type: "project_payout",
						reason,
						payout_submission: [submissionId],
					},
				},
			],
		}),
	});
	if (!res.ok) return null;
	const data = await res.json();
	return data.records?.[0]?.id ?? null;
}

export async function linkSubmissionPayoutTransaction(
	submissionId: string,
	ledgerRecordId: string,
): Promise<boolean> {
	const res = await fetch(`${BASE()}/submissions/${submissionId}`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify({ fields: { payout_transaction: [ledgerRecordId] } }),
	});
	return res.ok;
}

export interface ShopItemRecord {
	id: string;
	name: string;
	description: string;
	price: number;
	imageUrl?: string;
	priority: boolean;
}

export interface ShopOrderRecord {
	id: string;
	user_id: string;
	user_slack_id: string;
	item_id: string;
	item_name: string;
	status: "submitted" | "fulfilled";
	created_at: string;
	address?: {
		line_1?: string;
		line_2?: string;
		city?: string;
		state?: string;
		postal_code?: string;
		country?: string;
	};
}

export async function getShopItems(): Promise<ShopItemRecord[]> {
	const res = await fetch(`${BASE()}/Shop%20Items`, { headers: HEADERS() });
	if (!res.ok) return [];
	const data = await res.json();
	return (data.records ?? []).map(
		(r: { id: string; fields: Record<string, unknown> }) => ({
			id: r.id,
			name: (r.fields.Name as string) ?? "",
			description: (r.fields.Description as string) ?? "",
			price: (r.fields.Price as number) ?? 0,
			imageUrl: (r.fields.Image as string | undefined) ?? undefined,
			priority: (r.fields.Priority as boolean) ?? false,
		}),
	);
}

export async function getShopItemById(
	id: string,
): Promise<ShopItemRecord | null> {
	const res = await fetch(`${BASE()}/Shop%20Items/${id}`, {
		headers: HEADERS(),
	});
	if (!res.ok) return null;
	const r = await res.json();
	return {
		id: r.id,
		name: (r.fields.Name as string) ?? "",
		description: (r.fields.Description as string) ?? "",
		price: (r.fields.Price as number) ?? 0,
		imageUrl: (r.fields.Image as string | undefined) ?? undefined,
		priority: (r.fields.Priority as boolean) ?? false,
	};
}

export async function createShopOrder(
	userId: string,
	itemId: string,
): Promise<ShopOrderRecord | null> {
	const res = await fetch(`${BASE()}/Shop%20Orders`, {
		method: "POST",
		headers: HEADERS(),
		body: JSON.stringify({
			records: [
				{
					fields: {
						user: [userId],
						item: [itemId],
						status: "submitted",
					},
				},
			],
		}),
	});
	if (!res.ok) return null;
	const data = await res.json();
	const r = data.records?.[0];
	if (!r) return null;
	return {
		id: r.id,
		user_id: userId,
		user_slack_id: "",
		item_id: itemId,
		item_name: "",
		status: r.fields.status ?? "submitted",
		created_at: r.createdTime ?? "",
	};
}

export async function createShopLedgerEntry(
	userAirtableId: string,
	shopItemId: string,
	reason: string,
): Promise<string | null> {
	const res = await fetch(`${BASE()}/ledger`, {
		method: "POST",
		headers: HEADERS(),
		body: JSON.stringify({
			records: [
				{
					fields: {
						user: [userAirtableId],
						type: "shop_purchase",
						reason,
						purchased_item: [shopItemId],
					},
				},
			],
		}),
	});
	if (!res.ok) return null;
	const data = await res.json();
	return data.records?.[0]?.id ?? null;
}

export async function getAllShopOrders(): Promise<ShopOrderRecord[]> {
	const orders: ShopOrderRecord[] = [];
	let offset: string | undefined;

	do {
		const url = new URL(`${BASE()}/Shop%20Orders`);
		if (offset) url.searchParams.set("offset", offset);
		const res = await fetch(url.toString(), { headers: HEADERS() });
		if (!res.ok) break;
		const data = await res.json();
		for (const r of data.records ?? []) {
			const userIds: string[] = r.fields.user ?? [];
			const itemIds: string[] = r.fields.item ?? [];

			let userSlackId = "";
			let address: ShopOrderRecord["address"];
			if (userIds[0]) {
				const userRes = await fetch(`${BASE()}/users/${userIds[0]}`, {
					headers: HEADERS(),
				});
				if (userRes.ok) {
					const userData = await userRes.json();
					const f = userData.fields ?? {};
					userSlackId = (f.slack_id as string) ?? "";
					address = {
						line_1: (f.address_line_1 as string) ?? undefined,
						line_2: (f.address_line_2 as string) ?? undefined,
						city: (f.address_city as string) ?? undefined,
						state: (f.address_state as string) ?? undefined,
						postal_code: (f.address_postal_code as string) ?? undefined,
						country: (f.address_country as string) ?? undefined,
					};
				}
			}

			let itemName = "";
			if (itemIds[0]) {
				const itemRes = await fetch(`${BASE()}/Shop%20Items/${itemIds[0]}`, {
					headers: HEADERS(),
				});
				if (itemRes.ok) {
					const itemData = await itemRes.json();
					itemName = (itemData.fields?.Name as string) ?? "";
				}
			}

			orders.push({
				id: r.id,
				user_id: userIds[0] ?? "",
				user_slack_id: userSlackId,
				item_id: itemIds[0] ?? "",
				item_name: itemName,
				status: r.fields.status ?? "submitted",
				created_at: r.createdTime ?? "",
				address,
			});
		}
		offset = data.offset;
	} while (offset);

	return orders;
}

export async function updateShopOrderStatus(
	orderId: string,
	status: "submitted" | "fulfilled",
): Promise<boolean> {
	const res = await fetch(`${BASE()}/Shop%20Orders/${orderId}`, {
		method: "PATCH",
		headers: HEADERS(),
		body: JSON.stringify({ fields: { status } }),
	});
	return res.ok;
}

export interface LedgerEntryRecord {
	id: string;
	type: "project_payout" | "shop_purchase";
	reason: string;
	amount: number | null;
	created_at: string;
}

export async function getLedgerEntriesByUserId(
	userAirtableId: string,
): Promise<LedgerEntryRecord[]> {
	const entries: LedgerEntryRecord[] = [];
	let offset: string | undefined;

	do {
		const url = new URL(`${BASE()}/ledger`);
		url.searchParams.set("sort[0][field]", "id");
		url.searchParams.set("sort[0][direction]", "desc");
		if (offset) url.searchParams.set("offset", offset);
		const res = await fetch(url.toString(), { headers: HEADERS() });
		if (!res.ok) break;
		const data = await res.json();
		for (const r of data.records ?? []) {
			const userIds: string[] = r.fields.user ?? [];
			if (!userIds.includes(userAirtableId)) continue;

			let amount: number | null = null;
			const type = r.fields.type ?? "project_payout";
			if (type === "project_payout") {
				const subId = r.fields.payout_submission?.[0];
				if (subId) {
					const subRes = await fetch(`${BASE()}/submissions/${subId}`, {
						headers: HEADERS(),
					});
					if (subRes.ok) {
						const subData = await subRes.json();
						amount = (subData.fields?.payout as number) ?? null;
					}
				}
			} else if (type === "shop_purchase") {
				const itemId = r.fields.purchased_item?.[0];
				if (itemId) {
					const itemRes = await fetch(`${BASE()}/Shop%20Items/${itemId}`, {
						headers: HEADERS(),
					});
					if (itemRes.ok) {
						const itemData = await itemRes.json();
						amount = (itemData.fields?.Price as number) ?? null;
						if (amount !== null) amount = -amount;
					}
				}
			}

			entries.push({
				id: r.id,
				type,
				reason: r.fields.reason ?? "",
				amount,
				created_at: r.createdTime ?? "",
			});
		}
		offset = data.offset;
	} while (offset);

	return entries;
}

export async function getShopOrdersByUserId(
	userAirtableId: string,
): Promise<ShopOrderRecord[]> {
	const orders: ShopOrderRecord[] = [];
	let offset: string | undefined;

	do {
		const url = new URL(`${BASE()}/Shop%20Orders`);
		url.searchParams.set("sort[0][field]", "id");
		url.searchParams.set("sort[0][direction]", "desc");
		if (offset) url.searchParams.set("offset", offset);
		const res = await fetch(url.toString(), { headers: HEADERS() });
		if (!res.ok) break;
		const data = await res.json();
		for (const r of data.records ?? []) {
			const userIds: string[] = r.fields.user ?? [];
			if (!userIds.includes(userAirtableId)) continue;
			const itemIds: string[] = r.fields.item ?? [];
			let itemName = "";
			if (itemIds[0]) {
				const itemRes = await fetch(`${BASE()}/Shop%20Items/${itemIds[0]}`, {
					headers: HEADERS(),
				});
				if (itemRes.ok) {
					const itemData = await itemRes.json();
					itemName = (itemData.fields?.Name as string) ?? "";
				}
			}
			orders.push({
				id: r.id,
				user_id: userAirtableId,
				user_slack_id: "",
				item_id: itemIds[0] ?? "",
				item_name: itemName,
				status: r.fields.status ?? "submitted",
				created_at: r.createdTime ?? "",
			});
		}
		offset = data.offset;
	} while (offset);

	return orders;
}

export async function createShipEntry(data: {
	user: UserRecord;
	code_url: string;
	playable_url: string;
	hours_spent: number;
	override_hours_justification: string;
	screenshot: string;
	description: string;
}): Promise<boolean> {
	const fields: Record<string, unknown> = {
		"First Name": data.user.legal_first_name ?? data.user.first_name ?? "",
		"Last Name": data.user.legal_last_name ?? data.user.last_name ?? "",
		Email: data.user.email ?? "",
		Birthday: data.user.birthday ?? "",
		"Address (Line 1)": data.user.address_line_1 ?? "",
		"Address (Line 2)": data.user.address_line_2 ?? "",
		City: data.user.address_city ?? "",
		"State / Province": data.user.address_state ?? "",
		"ZIP / Postal Code": data.user.address_postal_code ?? "",
		Country: data.user.address_country ?? "",
		"Code URL": data.code_url,
		"Playable URL": data.playable_url,
		"Optional - Override Hours Spent": data.hours_spent,
		"Optional - Override Hours Spent Justification":
			data.override_hours_justification,
		Screenshot: [{ url: data.screenshot }],
		Description: data.description,
	};
	console.log("[createShipEntry] POST to unified table", {
		hasCodeUrl: Boolean(data.code_url),
		hasPlayableUrl: Boolean(data.playable_url),
		hoursSpent: data.hours_spent,
		hasOverrideHoursJustification: Boolean(data.override_hours_justification),
		hasScreenshot: Boolean(data.screenshot),
		hasDescription: Boolean(data.description),
	});
	const res = await fetch(
		`${BASE()}/${import.meta.env.AIRTABLE_UNIFIED_TABLE_ID}`,
		{
			method: "POST",
			headers: HEADERS(),
			body: JSON.stringify({ records: [{ fields }] }),
		},
	);
	if (!res.ok) {
		const text = await res.text();
		console.error("[createShipEntry] Airtable error", res.status, text);
	} else {
		console.log("[createShipEntry] success");
	}
	return res.ok;
}
