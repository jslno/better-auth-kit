import type { BetterAuthPlugin, PrettifyDeep } from "better-auth";
import type { FileRouter, FileStorageOptions, StorageProvider } from "./types";
import {
	createAuthEndpoint,
	sessionMiddleware,
	APIError,
} from "better-auth/api";
import {
	MaxFileSizeExceededError,
	MaxHeaderSizeExceededError,
	parseMultipartStream,
} from "@remix-run/multipart-parser";
import { ERROR_CODES } from "./error-codes";
import type {
	DeleteReturnType,
	FileRouterToEndpoints,
	Merged,
	UploadReturnType,
} from "./internal-types";
import { transformPath } from "./utils";
import { betterFetch } from "@better-fetch/fetch";

export const fileStorage = <
	P extends StorageProvider<any>,
	R extends FileRouter<P>,
>(
	options: FileStorageOptions<P, R>,
) => {
	const endpoints = Object.fromEntries(
		Object.entries(options.router).flatMap(([path, route]) => {
			const entries = Object.entries({
				[`upload${transformPath(path)}`]: createAuthEndpoint(
					`/file-storage/upload/${path}`,
					{
						method: "POST",
						use: [sessionMiddleware],
						body: undefined,
						metadata: {
							$Infer: {
								body: FormData,
							},
						},
						requireRequest: true,
						cloneRequest: true,
					},
					async (ctx): Promise<UploadReturnType> => {
						const session = ctx.context.session;
						const baseURL = ctx.context.options.baseURL;
						const basePath = ctx.context.options.basePath;

						if (!ctx.request.body) {
							throw ctx.error("BAD_REQUEST", {
								code: ERROR_CODES.MISSING_BODY,
							});
						}

						const contentType = ctx.request.headers.get("content-type");
						if (!contentType) {
							throw new APIError("BAD_REQUEST", {
								message: ERROR_CODES.MISSING_CONTENT_TYPE_HEADER,
							});
						}

						const match = contentType.match(/boundary=(.*)$/);
						if (!match || !match[1]) {
							throw new APIError("BAD_REQUEST", {
								message: ERROR_CODES.MISSING_BOUNDARY_IN_CONTENT_TYPE_HEADER,
							});
						}
						const boundary = match[1];

						const maxFileSize =
							(typeof route.maxSize === "function"
								? await route.maxSize(session)
								: route.maxSize) ?? 5_242_880;

						const maxHeaderSize =
							typeof route.maxHeaderSize === "function"
								? await route.maxHeaderSize(session)
								: route.maxHeaderSize;

						const maxFiles =
							(typeof route.maxFiles === "function"
								? await route.maxFiles(session)
								: route.maxFiles) ?? Number.POSITIVE_INFINITY;

						const allowedTypes =
							typeof route.allowedTypes === "function"
								? await route.allowedTypes(session)
								: route.allowedTypes;

						try {
							let count = 0;
							const uploadedFiles: UploadReturnType = [];
							for await (const part of parseMultipartStream(ctx.request.body, {
								boundary,
								maxFileSize,
								maxHeaderSize,
							})) {
								// TODO: Collect text fields
								if (part.isFile && part.name === "file") {
									count++;
									if (count > maxFiles) {
										throw new APIError("BAD_REQUEST", {
											message: ERROR_CODES.MAX_FILES_EXCEEDED,
										});
									}

									if (
										allowedTypes?.length &&
										!allowedTypes.includes(
											part.mediaType ?? "application/octet-stream",
										)
									) {
										throw new APIError("BAD_REQUEST", {
											message: ERROR_CODES.INVALID_FILE_TYPE,
										});
									}

									const {
										key,
										eTag: _eTag,
										providerUrl,
									} = await options.provider.upload({
										part,
										// TODO: generateKey option
										key: `${path}/${Date.now()}-${part.filename}`,
										route,
										context: ctx,
									});

									uploadedFiles.push({
										providerUrl,
										fileStorageUrl: `${baseURL}${basePath}/fs/${key}`,
									});
								}
							}

							return uploadedFiles;
						} catch (error) {
							if (error instanceof MaxFileSizeExceededError) {
								throw new APIError("PAYLOAD_TOO_LARGE", {
									message: ERROR_CODES.MAX_FILE_SIZE_EXCEEDED,
								});
							}
							if (error instanceof MaxHeaderSizeExceededError) {
								throw new APIError("REQUEST_HEADER_FIELDS_TOO_LARGE", {
									message: ERROR_CODES.MAX_HEADER_SIZE_EXCEEDED,
								});
							}
							if (error instanceof APIError) {
								throw error;
							}

							throw new APIError("INTERNAL_SERVER_ERROR", {
								message:
									(error instanceof Error ? error.message : null) ??
									`An unexpected error occurred: ${error}`,
							});
						}
					},
				),
				[`delete${transformPath(path)}`]: createAuthEndpoint(
					`/file-storage/delete/${path}`,
					{ method: "POST" },
					async (ctx): Promise<DeleteReturnType> => {},
				),
			});

			return entries;
		}),
	) as PrettifyDeep<Merged<FileRouterToEndpoints<R>>>;

	return {
		id: "file-storage",
		// @ts-ignore
		endpoints: {
			...endpoints,
			getFile: createAuthEndpoint(
				"/fs/:key/:path",
				{
					method: "GET",
					metadata: {
						client: false,
					},
				},
				async (ctx) => {
					const { key, path } = ctx.params;

					if (!path || !key) {
						throw new APIError("NOT_FOUND");
					}

					const file = await ctx.context.adapter.findOne<{ url: string }>({
						model: "fileStorage",
						where: [
							{
								field: "key",
								value: key,
								connector: "AND",
							},
							{
								field: "path",
								value: path,
							},
						],
						select: ["url"],
					});

					if (!file) {
						throw new APIError("NOT_FOUND");
					}

					const { data, error } = await betterFetch(file.url);

					if (error) {
						ctx.context.logger.error(
							`[Better-Auth-Kit: FileStorage] Failed to fetch file from URL: "${file.url}"\n`,
							error,
						);
						throw new APIError("INTERNAL_SERVER_ERROR");
					}

					return data;
				},
			),
		},
		$ERROR_CODES: ERROR_CODES,
		$Infer: {
			FileStoragePaths: {} as keyof typeof options.router,
		},
	} satisfies BetterAuthPlugin;
};

export * from "./client";
export * from "./types";
