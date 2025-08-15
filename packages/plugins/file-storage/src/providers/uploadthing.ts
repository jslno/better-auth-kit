import { UTFile, type UTApi } from "uploadthing/server";
import { createStorageProvider } from ".";
import { ERROR_CODES } from "../error-codes";
import { betterFetch } from "@better-fetch/fetch";

export type UploadThingProviderOptions = {
	utapi: UTApi;
};

export const uploadThingProvider = <O extends UploadThingProviderOptions>(
	options: O,
) => {
	const { utapi } = options;

	return createStorageProvider({
		upload: async ({ part, key, route, context }) => {
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
					acl: route.acl ?? "private",
					contentDisposition: route.contentDisposition,
				})
			)[0]!;

			return {
				key: data?.key,
				providerUrl: data?.url,
			};
		},
		delete: async ({ key, route }) => {
			const { success } = await utapi.deleteFiles(key, {
				keyType: "customId",
			});
		},
		read: async ({ url, route, context }) => {
			if (!url) {
				throw context.error("NOT_FOUND");
			}

			let contentType: string | undefined;

			const { data, error } = await betterFetch(url, {
				onResponse(context) {
					contentType = context.response.headers
						.get("content-type")
						?.split(";")[0]
						.trim();
				},
			});

			if (error) {
				context.context.logger.error(
					`[Better-Auth-Kit: FileStorage] Failed to fetch file from URL: "${url}"\n`,
					error,
				);
				throw context.error("INTERNAL_SERVER_ERROR");
			}

			return {
				contentType: contentType ?? "application/octet-stream",
				contentDisposition: route.contentDisposition,
				content: data,
			};
		},
		$Infer: {
			Options: {} as {
				contentDisposition?: "inline" | "attachment";
				acl?: "public-read" | "private";
			},
		},
	});
};
