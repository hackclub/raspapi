import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const guides = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/guides" }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		order: z.number().default(0),
	}),
});

export const collections = { guides };
