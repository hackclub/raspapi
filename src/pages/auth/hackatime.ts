import type { APIRoute } from "astro";
import { getSession } from "../../lib/session";

export const GET: APIRoute = async ({ url, cookies }) => {
	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session)
		return Response.redirect(`${import.meta.env.PUBLIC_BASE_URL}/auth/login`);

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(import.meta.env.SESSION_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const payload = btoa(
		JSON.stringify({ slack_id: session.slack_id, ts: Date.now() }),
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	const state = `${payload}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;

	const params = new URLSearchParams({
		response_type: "code",
		client_id: import.meta.env.HACKATIME_UID,
		redirect_uri: `${import.meta.env.PUBLIC_BASE_URL}/auth/hackatime/callback`,
		scope: "profile read",
		state,
	});

	return Response.redirect(
		`https://hackatime.hackclub.com/oauth/authorize?${params}`,
	);
};
