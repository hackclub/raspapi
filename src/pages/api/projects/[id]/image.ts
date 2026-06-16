import type { APIRoute } from "astro";
import { getProjectById, updateProjectImage } from "../../../../lib/airtable";
import { getSession } from "../../../../lib/session";

export const PUT: APIRoute = async ({ request, cookies, params }) => {
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

	let data: FormData;
	try {
		data = await request.formData();
	} catch {
		return Response.json({ error: "Invalid form data body" }, { status: 400 });
	}

	const image = data.get("image");
	if (!(image instanceof File)) {
		return Response.json({ error: "No image file found" }, { status: 400 });
	}

	// Validate image MIME type and size before processing
	const allowedTypes = [
		"image/jpeg",
		"image/png",
		"image/gif",
		"image/webp",
		"image/heic",
		"image/heif",
	];
	if (!image.type || !allowedTypes.includes(image.type)) {
		return Response.json(
			{
				error:
					"Invalid image type. Allowed types are JPEG, PNG, GIF, WEBP, and HEIC.",
			},
			{ status: 400 },
		);
	}

	// Enforce a maximum upload size. Phone photos routinely exceed a few MB, so
	// keep this generous enough that a normal camera image isn't rejected.
	const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024;
	if (image.size > MAX_IMAGE_SIZE_BYTES) {
		return Response.json(
			{ error: "Image file is too large. Maximum size is 25 MB." },
			{ status: 413 },
		);
	}
	const ok = await updateProjectImage(id, image);
	if (!ok) {
		return Response.json(
			{ error: "Failed to upload image. Please try again." },
			{ status: 500 },
		);
	}
	return Response.json({});
};
