export async function uploadToCDN(file: Blob): Promise<string | null> {
	if (!import.meta.env.CDN_API_KEY) {
		console.error("[uploadToCDN] CDN_API_KEY is not set");
		return null;
	}

	const formData = new FormData();
	formData.append("file", file);

	let res: Response;
	try {
		res = await fetch("https://cdn.hackclub.com/api/v4/upload", {
			method: "POST",
			headers: { Authorization: `Bearer ${import.meta.env.CDN_API_KEY}` },
			body: formData,
		});
	} catch (e) {
		console.error("[uploadToCDN] network error reaching CDN", e);
		return null;
	}

	if (!res.ok) {
		const body = await res.text().catch(() => "");
		console.error("[uploadToCDN] CDN upload failed", res.status, body);
		return null;
	}

	let data: unknown;
	try {
		data = await res.json();
	} catch (e) {
		console.error("[uploadToCDN] failed to parse CDN response as JSON", e);
		return null;
	}

	const url = extractUrl(data);
	if (!url) {
		console.error(
			"[uploadToCDN] no URL found in CDN response",
			JSON.stringify(data),
		);
		return null;
	}
	return url;
}

// The CDN's response shape has changed across versions, so pull the URL out of
// any of the shapes it has used rather than assuming a single key.
function extractUrl(data: unknown): string | null {
	if (!data || typeof data !== "object") return null;
	// biome-ignore lint/suspicious/noExplicitAny: defensive parsing of external response
	const d = data as Record<string, any>;
	const first = d.files?.[0];
	return (
		d.url ??
		d.cdnUrl ??
		d.deployedUrl ??
		d.file?.url ??
		first?.url ??
		(typeof first === "string" ? first : null) ??
		null
	);
}
