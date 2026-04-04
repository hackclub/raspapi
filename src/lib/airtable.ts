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
	review_status: "submitted" | "rejected" | "approved";
	reviewer_notes: string;
	multiplier: number;
	payout: number;
	payout_transaction_id?: string;
}

export async function upsertUser(
	slack_id: string,
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
			return {
				id: r.id,
				slack_id: r.fields.slack_id,
				hackatime_token: r.fields.hackatime_token ?? undefined,
				balance: r.fields.balance ?? 0,
				row_number: r.fields.row_number ?? undefined,
				referer: r.fields.referer ?? undefined,
			};
		}
	}

	const fields: Record<string, unknown> = { slack_id };
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
	return {
		id: r.id,
		slack_id: r.fields.slack_id,
		balance: 0,
		row_number: r.fields.row_number ?? undefined,
		referer: r.fields.referer ?? undefined,
	};
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
	const r = data.records[0];
	return {
		id: r.id,
		slack_id: r.fields.slack_id,
		hackatime_token: r.fields.hackatime_token ?? undefined,
		balance: r.fields.balance ?? 0,
		row_number: r.fields.row_number ?? undefined,
		referer: r.fields.referer ?? undefined,
	};
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
			records.push({
				id: r.id,
				slack_id: r.fields.slack_id,
				balance: r.fields.balance ?? 0,
			});
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
		review_status: r.fields.review_status,
		reviewer_notes: r.fields.reviewer_notes ?? "",
		multiplier: r.fields.multiplier ?? 1,
		payout: r.fields.payout ?? 0,
		payout_transaction_id: r.fields.payout_transaction?.[0] ?? undefined,
	};
}
