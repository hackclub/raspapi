import type { APIRoute } from "astro";
import { updateProjectHoursCache } from "../../../lib/airtable";
import { getSession } from "../../../lib/session";

export const GET: APIRoute = async ({ cookies, url }) => {
	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	const project = url.searchParams.get("project");
	const recordId = url.searchParams.get("id");
	if (!project) {
		return Response.json({ error: "Missing project" }, { status: 400 });
	}

	const start = "2026-03-30T00:00:00Z";
	const apiUrl = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(session.slack_id)}/project/${encodeURIComponent(project)}?start=${start}`;
	console.log("[project-time] fetching", apiUrl);

	let res: Response;
	try {
		res = await fetch(apiUrl);
	} catch (err) {
		return Response.json(
			{ error: "Failed to reach Hackatime" },
			{ status: 502 },
		);
	}

	if (res.status === 401 || res.status === 403) {
		return Response.json({ error: "private" }, { status: 403 });
	}

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		console.error("[project-time] hackatime error body:", body); // TODO: handle {"error": "found nuthin"}
		return Response.json({ error: "Hackatime error" }, { status: 502 });
	}

	const data = await res.json();
	console.log("[project-time] response data:", JSON.stringify(data));

	const totalSeconds: number = data?.total_seconds ?? 0;

	const hours = totalSeconds / 3600;
	const updatedAt = Date.now();

	if (recordId) {
		updateProjectHoursCache(recordId, hours, updatedAt).catch(() => {});
	}

	return Response.json({ total_seconds: totalSeconds });
};
