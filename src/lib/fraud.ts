const JOE_KEY = import.meta.env.JOE_KEY;

const BASE = "https://joe.fraud.hackclub.com/api/v1/ysws";

export interface FraudHackatimeProject {
	name: string;
	totalDurationSeconds: number;
	firstHeartbeatAt: string;
	lastHeartbeatAt: string;
}

export interface FraudReview {
	trustScore: number;
	justification: string;
	reviewedAt: string;
}

export interface FraudOutcome {
	status: "approved" | "rejected" | "pending" | string;
	reason: string | null;
	recordedAt: string;
}

export interface FraudProject {
	id: string;
	name: string;
	codeLink: string;
	demoLink: string;
	organizerPlatformId: string;
	status: string;
	hackatimeTrackedSeconds: number;
	hackatimeProjects: FraudHackatimeProject[];
	review: FraudReview | null;
	outcome: FraudOutcome | null;
	createdAt: string;
	updatedAt: string;
}

export async function createProject(
	name: string,
	repo: string,
	demo: string,
	user: string,
	projects: string[],
	organizerPlatformId: string,
) {
	const endpoint = `${BASE}/events/raspapi/projects`;
	const data = fetch(endpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${JOE_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			name,
			codeLink: repo,
			demoLink: demo,
			submitter: { slackId: user },
			hackatimeProjects: projects,
			organizerPlatformId,
		}),
	});
	const d = await data;

	if (d.status !== 201) {
		console.log(
			"[fraud] createProject failed:",
			JSON.stringify({
				name,
				codeLink: repo,
				demoLink: demo,
				submitter: { slackId: user },
				hackatimeProjects: projects,
				organizerPlatformId,
			}),
		);
		return "error";
	}
	return "success";
}

export async function listProjects(): Promise<{ projects: FraudProject[] }> {
	const endpoint = `${BASE}/events/raspapi/projects`;
	const data = fetch(endpoint, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${JOE_KEY}`,
			"Content-Type": "application/json",
		},
	});
	return (await data).json();
}
