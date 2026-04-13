import type { APIRoute } from "astro";
import { z } from "astro/zod";
import {
	getSubmissionById,
	updateSubmissionReview,
	getProjectById,
	updateProjectApprovedHours,
	getUserBySlackId,
	createLedgerEntry,
	linkSubmissionPayoutTransaction,
} from "../../../lib/airtable";
import { getSession } from "../../../lib/session";

const ReviewSchema = z.object({
	action: z.enum(["approved", "rejected"]),
	multiplier: z.number().min(1).max(3),
	notes: z.string().optional(),
	buffs: z.array(z.string()).optional(),
});

import { App } from "slack.ts";

const app = new App({
	token: import.meta.env.SLACK_BOT_TOKEN,
});

function formatBuffBreakdown(buffs: string[]): string {
	const buffLabels: Record<string, string> = {
		auth: "Authorization +0.15",
		persistence: "Persistence +0.10",
		external_api: "External API +0.10",
		rate_limiting: "Rate limiting +0.10",
		pagination: "Pagination +0.05",
		error_handling: "Error handling +0.05",
		cool_project: "Cool project x1.3",
		exceptional_quality: "Exceptional quality x1.2",
	};

	const formatted: string[] = [];
	for (const buff of buffs) {
		if (buff.startsWith("endpoints:")) {
			const count = parseInt(buff.split(":")[1], 10);
			formatted.push(
				`Additional endpoints (${count}) +${(count * 0.03).toFixed(2)}`,
			);
		} else if (buffLabels[buff]) {
			formatted.push(buffLabels[buff]);
		}
	}

	return formatted.length > 0 ? formatted.join(", ") : "base";
}

export const POST: APIRoute = async ({ cookies, params, request }) => {
	const id = params.id;
	if (!id) {
		return Response.json(
			{ error: "No submission ID specified" },
			{ status: 404 },
		);
	}

	const session = await getSession(cookies, import.meta.env.SESSION_SECRET);
	if (!session) {
		return Response.json({ error: "Not logged in" }, { status: 401 });
	}

	const adminIds = (import.meta.env.ADMIN_IDS ?? "")
		.split(",")
		.map((s: string) => s.trim())
		.filter(Boolean);

	if (!adminIds.includes(session.slack_id)) {
		return Response.json({ error: "Not authorized" }, { status: 403 });
	}

	const submission = await getSubmissionById(id);
	if (!submission) {
		return Response.json({ error: "Submission not found" }, { status: 404 });
	}

	if (submission.review_status !== "submitted") {
		return Response.json(
			{ error: "Submission already reviewed" },
			{ status: 409 },
		);
	}

	let payload: z.infer<typeof ReviewSchema>;
	try {
		payload = ReviewSchema.parse(await request.json());
	} catch (e) {
		if (e instanceof z.ZodError) {
			const messages = e.errors
				.map((err) => `${err.path.join(".")}: ${err.message}`)
				.join(", ");
			return Response.json({ error: messages }, { status: 400 });
		}
		return Response.json({ error: "Invalid body" }, { status: 400 });
	}

	const buffs = payload.buffs ?? [];

	const updated = await updateSubmissionReview(id, {
		review_status: payload.action,
		multiplier: payload.multiplier,
		reviewer_notes: payload.notes ?? "",
		buffs: buffs.join(","),
	});

	if (!updated) {
		return Response.json(
			{ error: "Failed to update submission" },
			{ status: 500 },
		);
	}

	if (payload.action === "approved" && submission.project_id) {
		const [project, submitter] = await Promise.all([
			getProjectById(submission.project_id),
			getUserBySlackId(submission.user_slack_id),
		]);

		if (project) {
			const newApprovedHours =
				(project.approved_hours ?? 0) + submission.hours_at_submission;
			await updateProjectApprovedHours(submission.project_id, newApprovedHours);
		}

		if (submitter) {
			const ledgerId = await createLedgerEntry(
				submitter.id,
				id,
				`Project: ${submission.project_name}`,
			);
			if (ledgerId) {
				await linkSubmissionPayoutTransaction(id, ledgerId);
			} else {
				console.error(
					"[review] Failed to create ledger entry for submission",
					id,
				);
			}
		} else {
			console.error(
				"[review] Could not find user for slack_id",
				submission.user_slack_id,
			);
		}
	}

	const payout = Math.round(
		submission.hours_at_submission * 4 * payload.multiplier,
	);
	const buffBreakdown = formatBuffBreakdown(buffs);

	const airtableLink =
		import.meta.env.AIRTABLE_BASE_ID &&
		import.meta.env.AIRTABLE_SUBMISSIONS_TABLE_ID
			? `https://airtable.com/${import.meta.env.AIRTABLE_BASE_ID}/${import.meta.env.AIRTABLE_SUBMISSIONS_TABLE_ID}/${id}`
			: id;

	const logChannel = import.meta.env.SLACK_LOGS_CHANNEL;
	if (logChannel) {
		const logMessage = `[REVIEW] <@${session.slack_id}> -> ${payload.action}
Submitter: <@${submission.user_slack_id}>
Project: ${submission.project_name}${submission.project_url ? ` - ${submission.project_url}` : ""}
Repo: ${submission.repo_url || "none"}
Hours: ${submission.hours_at_submission.toFixed(2)}h
Multiplier: ${payload.multiplier.toFixed(2)} (${buffBreakdown})
Payout: ${payout} :raspberry_pi:
Notes: ${payload.notes || "none"}
Airtable: ${airtableLink}`;

		await app.channel(logChannel).send({ text: logMessage });
	}

	const dmLines =
		payload.action === "approved"
			? [
					`Your project *${submission.project_name}* has been approved! :yayayayayay:`,
					`*Hours:* ${submission.hours_at_submission.toFixed(2)}h`,
					`*Multiplier:* ${payload.multiplier.toFixed(2)} (${buffBreakdown})`,
					`*Payout:* ${payout} :raspberry_pi:`,
					payload.notes ? `*Reviewer notes:* ${payload.notes}` : null,
				]
			: [
					`Your project *${submission.project_name}* was not approved this time.`,
					payload.notes ? `*Reviewer notes:* ${payload.notes}` : null,
					`Feel free to make changes and resubmit.`,
				];

	await app
		.channel(submission.user_slack_id)
		.send({ text: dmLines.filter(Boolean).join("\n") });

	return Response.json({ success: true });
};
