import type { APIRoute } from "astro";
import { clearSessionCookie } from "../../lib/session";

export const GET: APIRoute = () => {
	return new Response(null, {
		status: 302,
		headers: { Location: "/", "Set-Cookie": clearSessionCookie() },
	});
};
