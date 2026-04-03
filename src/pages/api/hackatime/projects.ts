import type { APIRoute } from "astro";
import { getUserBySlackId } from "../../../lib/airtable";
import { getSession } from "../../../lib/session";

export const GET: APIRoute = async ({ cookies }) => {
	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	const user = await getUserBySlackId(session.slack_id);
	if (!user?.hackatime_token) {
		return Response.json({ error: "Hackatime not connected" }, { status: 400 });
	}

	const res = await fetch(
		"https://hackatime.hackclub.com/api/v1/authenticated/projects",
		{
			headers: { Authorization: `Bearer ${user.hackatime_token}` },
		},
	);

	if (!res.ok) {
		return Response.json(
			{ error: "Failed to fetch Hackatime projects" },
			{ status: 502 },
		);
	}

	const data = await res.json();
	const names: string[] = (data.projects ?? []).map(
		(p: { name: string }) => p.name,
	);
	return Response.json(names);
};
