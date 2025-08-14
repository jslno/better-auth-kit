import { UTFile, type UTApi } from "uploadthing/server";
import { createStorageProvider } from ".";
import type { Session, User } from "better-auth";
import { ERROR_CODES } from "../error-codes";

export type UploadThingProviderOptions = {
	utapi: UTApi;
};

export const uploadThingProvider = <O extends UploadThingProviderOptions>(
	options: O,
) => {
	const { utapi } = options;

	return createStorageProvider({
		upload: async ({ part, key, route, context }) => {
			const metadata =
				typeof route.metadata === "function"
					? await route.metadata(context.context.session!)
					: route.metadata;

			if (!part.filename) {
				throw context.error("BAD_REQUEST", {
					message: ERROR_CODES.UNABLE_TO_RETRIEVE_FILENAME,
				});
			}

			const file = new UTFile([part.bytes], part.filename, {
				type: part.mediaType ?? "application/octet-stream",
				customId: key,
			});

			const { data } = (
				await utapi.uploadFiles([file], {
					metadata,
					acl: route.acl ?? "private",
					contentDisposition: route.contentDisposition,
				})
			)[0]!;

			return {
				key: data?.key,
				providerUrl: data?.url,
			};
		},
		delete: async ({ fileURL }) => {},
		$Infer: {
			Options: {} as {
				contentDisposition?: "inline" | "attachment";
				acl?: "public-read" | "private";
				metadata?:
					| Json
					| ((session: {
							user: User & Record<string, any>;
							session: Session & Record<string, any>;
					  }) => Json | Promise<Json>);
			},
		},
	});
};

type JsonValue = string | number | boolean | null | undefined;
type JsonArray = JsonValue[];
type JsonObject = {
	[key: string]: JsonValue | JsonObject | JsonArray;
};
type Json = JsonValue | JsonObject | JsonArray;
