import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: import.meta.env.HCA_CLIENT_ID,
		redirect_uri: `${import.meta.env.PUBLIC_BASE_URL}/auth/callback`,
		scope: "verification_status slack_id",
	});

	return Response.redirect(
		`https://auth.hackclub.com/oauth/authorize?${params}`,
	);
};
