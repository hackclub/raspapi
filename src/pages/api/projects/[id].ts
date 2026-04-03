import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { getProjectById, updateProject } from "../../../lib/airtable";
import { getSession } from "../../../lib/session";

export const GET: APIRoute = async ({ cookies, params }) => {
	const id = params.id;
	if (!id) {
		return Response.json({ error: "No project ID specified" }, { status: 404 });
	}

	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	const project = await getProjectById(id);
	if (!project) {
		return Response.json({ error: "Project not found" }, { status: 404 });
	}
	if (project.user_slack_id !== session.slack_id) {
		return Response.json(
			{ error: "You cannot perform this operation" },
			{ status: 403 },
		);
	}
	return Response.json(project);
};

const updateProjectSchema = z.object({
	name: z.string().nonempty().optional(),
	project_url: z.string().url().nullable().optional(),
	repo_url: z.string().url().nullable().optional(),
	description: z.string().optional(),
	hackatime_project: z.string().nullable().optional(),
});

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
	const id = params.id;
	if (!id) {
		return Response.json({ error: "No project ID specified" }, { status: 404 });
	}

	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	const project = await getProjectById(id);
	if (!project) {
		return Response.json({ error: "Project not found" }, { status: 404 });
	}
	if (project.user_slack_id !== session.slack_id) {
		return Response.json(
			{ error: "You cannot perform this operation" },
			{ status: 403 },
		);
	}

	let payload: z.infer<typeof updateProjectSchema>;
	try {
		payload = updateProjectSchema.parse(await request.json());
	} catch (e) {
		const details = e instanceof z.ZodError ? e.format() : undefined;
		return Response.json({ error: "Invalid body", details }, { status: 400 });
	}

	const updated = await updateProject(id, payload);
	if (!updated) {
		return Response.json(
			{ error: "Failed to update project" },
			{ status: 500 },
		);
	}

	return Response.json(updated);
};
