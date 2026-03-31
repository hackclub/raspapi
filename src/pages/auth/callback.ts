import type { APIRoute } from "astro";
import { setSessionCookie } from "../../lib/session";
import { upsertUser } from "../../lib/airtable";

export const GET: APIRoute = async ({ url }) => {
	const code = url.searchParams.get("code");
	if (!code)
		return Response.redirect(
			`${import.meta.env.PUBLIC_BASE_URL}/?error=no_code`,
		);

	const res = await fetch("https://auth.hackclub.com/oauth/token", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			grant_type: "authorization_code",
			code,
			client_id: import.meta.env.HCA_CLIENT_ID,
			client_secret: import.meta.env.HCA_CLIENT_SECRET,
			redirect_uri: `${import.meta.env.PUBLIC_BASE_URL}/auth/callback`,
		}),
	});

	if (!res.ok)
		return Response.redirect(
			`${import.meta.env.PUBLIC_BASE_URL}/?error=auth_failed`,
		);

	const { access_token } = await res.json();

	const idRes = await fetch("https://auth.hackclub.com/api/v1/me", {
		headers: { Authorization: `Bearer ${access_token}` },
	});
	if (!idRes.ok)
		return Response.redirect(
			`${import.meta.env.PUBLIC_BASE_URL}/?error=userinfo_failed`,
		);

	const { identity } = await idRes.json();
	const slack_id: string = identity.slack_id ?? "";

	if (!slack_id)
		return Response.redirect(
			`${import.meta.env.PUBLIC_BASE_URL}/?error=no_user`,
		);
	if (!identity.ysws_eligible)
		return Response.redirect(
			`${import.meta.env.PUBLIC_BASE_URL}/?error=not_eligible`,
		);

	await upsertUser(slack_id);

	const cookie = await setSessionCookie(
		{ slack_id },
		import.meta.env.SESSION_SECRET,
	);

	return new Response(null, {
		status: 302,
		headers: { Location: "/me", "Set-Cookie": cookie },
	});
};
