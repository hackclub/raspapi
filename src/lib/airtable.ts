const BASE = () =>
	`https://api.airtable.com/v0/${import.meta.env.AIRTABLE_BASE_ID}`;
const HEADERS = () => ({
	Authorization: `Bearer ${import.meta.env.AIRTABLE_API_KEY}`,
	"Content-Type": "application/json",
});

export interface UserRecord {
	id: string;
	slack_id: string;
}

export async function upsertUser(slack_id: string): Promise<UserRecord | null> {
	const filter = encodeURIComponent(`{slack_id}="${slack_id}"`);
	const findRes = await fetch(
		`${BASE()}/users?filterByFormula=${filter}&maxRecords=1`,
		{ headers: HEADERS() },
	);
	if (findRes.ok) {
		const data = await findRes.json();
		if (data.records?.length > 0) {
			const r = data.records[0];
			return { id: r.id, slack_id: r.fields.slack_id };
		}
	}

	const createRes = await fetch(`${BASE()}/users`, {
		method: "POST",
		headers: HEADERS(),
		body: JSON.stringify({ records: [{ fields: { slack_id } }] }),
	});
	if (!createRes.ok) return null;
	const created = await createRes.json();
	const r = created.records?.[0];
	if (!r) return null;
	return { id: r.id, slack_id: r.fields.slack_id };
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
			records.push({ id: r.id, slack_id: r.fields.slack_id });
		}
		offset = data.offset;
	} while (offset);

	return records;
}
