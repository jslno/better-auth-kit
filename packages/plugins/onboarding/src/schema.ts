import type { AuthPluginSchema } from "better-auth";

export const schema = {
	user: {
		fields: {
			shouldOnboard: {
				type: "boolean",
			},
		},
	},
} satisfies AuthPluginSchema;
