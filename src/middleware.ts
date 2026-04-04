import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(({ url, cookies }, next) => {
	const r = url.searchParams.get("r");
	if (r && /^\d{1,7}$/.test(r) && parseInt(r, 10) > 0) {
		cookies.set("ref", r, {
			httpOnly: true,
			sameSite: "lax",
			maxAge: 600,
			path: "/",
		});
	}
	return next();
});
