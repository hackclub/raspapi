import type { APIRoute } from "astro";
import { z } from "astro/zod";
import {
	createProject,
	getAllProjectsBySlackId,
	getUserBySlackId,
} from "../../lib/airtable";
import { getSession } from "../../lib/session";

const createProjectSchema = z.object({
	name: z.string().nonempty(),
});

export const GET: APIRoute = async ({ cookies }) => {
	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	const projects = await getAllProjectsBySlackId(session.slack_id);
	return Response.json(projects);
};

export const POST: APIRoute = async ({ request, cookies }) => {
	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	let payload: z.infer<typeof createProjectSchema>;
	try {
		payload = createProjectSchema.parse(await request.json());
	} catch {
		return Response.json({ error: "Invalid body" }, { status: 400 });
	}

	const user = await getUserBySlackId(session.slack_id);
	if (!user) {
		return Response.json({ error: "User not found" }, { status: 500 });
	}

	const project = await createProject(user.id, payload.name);
	if (!project) {
		return Response.json(
			{ error: "Failed to create project" },
			{ status: 500 },
		);
	}
	return Response.json(project, { status: 201 });
};
