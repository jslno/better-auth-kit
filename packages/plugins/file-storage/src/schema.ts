import type { AuthPluginSchema } from "better-auth";

export const schema = {
	fileStorage: {
		fields: {
			key: {
				type: "string",
				unique: true,
			},
			url: {
				type: "string",
				required: false,
			},
			metadata: {
				type: "string",
				required: false,
			},
		},
	},
} satisfies AuthPluginSchema;

export type FileStorageSchema = typeof schema;
