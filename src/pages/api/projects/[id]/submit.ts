import type { APIRoute } from "astro";
import {
	createSubmission,
	getProjectById,
	getUserBySlackId,
} from "../../../../lib/airtable";
import { createProject as createFraudProject } from "../../../../lib/fraud";
import { getSession } from "../../../../lib/session";

export const POST: APIRoute = async ({ cookies, params }) => {
	const id = params.id;
	if (!id) {
		return Response.json({ error: "No project ID specified" }, { status: 404 });
	}

	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	const [project, user] = await Promise.all([
		getProjectById(id),
		getUserBySlackId(session.slack_id),
	]);

	if (!project) {
		return Response.json({ error: "Project not found" }, { status: 404 });
	}
	if (project.user_slack_id !== session.slack_id) {
		return Response.json(
			{ error: "You cannot perform this operation" },
			{ status: 403 },
		);
	}
	if (!project.hackatime_project) {
		return Response.json(
			{ error: "No hackatime project linked" },
			{ status: 400 },
		);
	}
	if (project.has_pending_submission) {
		return Response.json(
			{ error: "Project is already submitted" },
			{ status: 409 },
		);
	}
	if (
		!project.name ||
		!project.description ||
		!project.image_url ||
		!project.project_url ||
		!project.repo_url
	) {
		return Response.json(
			{ error: "Required fields missing in project" },
			{ status: 400 },
		);
	}

	const start = "2026-03-30T00:00:00Z";
	const apiUrl = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(session.slack_id)}/project/${encodeURIComponent(project.hackatime_project)}?start=${start}`;
	console.log("[submit] fetching", apiUrl);

	let res: Response;
	try {
		res = await fetch(apiUrl);
	} catch {
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
		console.error("[submit] hackatime error body:", body);
		return Response.json({ error: "Hackatime error" }, { status: 502 });
	}

	const data = await res.json();
	console.log("[submit] response data:", JSON.stringify(data));

	const totalSeconds: number = data?.total_seconds ?? 0;

	const hours = totalSeconds / 3600;
	const newHours = hours - project.approved_hours;
	if (newHours <= 0) {
		return Response.json({ error: "No new hours worked" }, { status: 400 });
	}

	const submission = await createSubmission(id, newHours);
	if (!submission) {
		return Response.json(
			{ error: "Failed to create submission" },
			{ status: 500 },
		);
	}

	createFraudProject(
		project.name,
		project.repo_url,
		project.project_url,
		session.slack_id,
		[project.hackatime_project],
		submission.id,
	).catch((e) => console.error("[submit] fraud createProject failed:", e));

	return Response.json({
		hours_at_submission: submission.hours_at_submission,
	});
};
