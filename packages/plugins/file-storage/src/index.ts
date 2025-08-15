import type { BetterAuthPlugin, PrettifyDeep } from "better-auth";
import type {
	FileRoute,
	FileRouter,
	FileStorageOptions,
	StorageProvider,
} from "./types";
import {
	createAuthEndpoint,
	APIError,
} from "better-auth/api";
import {
	MaxFileSizeExceededError,
	MaxHeaderSizeExceededError,
	parseMultipartStream,
} from "@remix-run/multipart-parser";
import { ERROR_CODES } from "./error-codes";
import type {
	FileRouterToEndpoints,
	Merged,
	UploadReturnType,
} from "./internal-types";
import { transformPath } from "./utils";
import { defu } from "defu";
import { mergeSchema } from "better-auth/db";
import { schema } from "./schema";

export const fileStorage = <
	P extends StorageProvider<any>,
	R extends FileRouter<P>,
>(
	options: FileStorageOptions<P, R>,
) => {
	const endpoints = Object.fromEntries(
		Object.entries(options.router).flatMap(
			([path, route]: [string, FileRoute & Record<string, any>]) => {
				const entries = Object.entries({
					[`upload${transformPath(path)}`]: createAuthEndpoint(
						`/file-storage/upload/${path}`,
						{
							method: "POST",
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

							if (route.hooks?.upload?.before) {
								const res = await route.hooks?.upload.before(ctx);

								if (typeof res === "object") {
									route = defu(route, res);
								}
							}

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
								const uploadedFiles: (UploadReturnType[number] & {
									metadata?: Record<string, any>;
								})[] = [];
								for await (const part of parseMultipartStream(
									ctx.request.body,
									{
										boundary,
										maxFileSize,
										maxHeaderSize,
									},
								)) {
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

										const metadata =
											typeof route.metadata === "function"
												? await route.metadata(session!)
												: route.metadata;

										const res = await options.provider.upload({
											part,
											// TODO: generateKey option
											key: `${path}/${Date.now()}-${part.filename}`,
											route,
											context: ctx,
										});

										const fileStorageURL = `${baseURL}${basePath}/fs/read/${res.key}`;

										uploadedFiles.push({
											providerURL: res.providerURL,
											fileStorageURL,
											metadata,
										});

										await ctx.context.adapter.create({
											model: "fileStorage",
											data: {
												key: res.key,
												url: res.providerURL,
												metadata: JSON.stringify(metadata),
											},
											select: [],
										});

										if (route.onFileUploaded) {
											await route.onFileUploaded({
												file: {
													...res,
													metadata,
													fileStorageURL,
												},
												ctx,
											});
										}
									}
								}

								if (route.hooks?.upload?.after) {
									await route.hooks.upload.after({
										context: ctx,
										uploadedFiles,
									});
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
					)
				});

				return entries;
			},
		),
	) as PrettifyDeep<Merged<FileRouterToEndpoints<R>>>;

	return {
		id: "file-storage",
		// @ts-ignore
		endpoints: {
			...endpoints,
			getFile: createAuthEndpoint(
				"/fs/read/:path/:key",
				{
					method: "GET"
				},
				async (ctx) => {
					let { path, key } = ctx.params;
		
					if (!path || !key) {
						throw ctx.error("NOT_FOUND");
					}
		
					const route: FileRoute & Record<string, any> = options.router[path];
					const filename = key.split("/").pop()!;
		
					key = `${path}/${key}`;
					const file = await ctx.context.adapter.findOne<{
						url: string | undefined;
						metadata: string | undefined;
					}>({
						model: "fileStorage",
						where: [
							{
								field: "key",
								value: key,
							},
						],
						select: ["url", "metadata"],
					});
		
					if (!file) {
						throw ctx.error("NOT_FOUND");
					}
		
					if (route.hooks?.read?.before) {
						await route.hooks.read.before({
							context: ctx,
							key,
							metadata: file.metadata ? JSON.parse(file.metadata) : undefined,
						});
					}
		
					const readFile =
					await options.provider.read({
							key,
							url: file.url,
							context: ctx,
							route,
						});
					const { content, contentType, contentCharset, contentDisposition } = readFile;
		
					const contentTypeStr = [
						contentType ?? "application/octet-stream",
						contentCharset ? `charset=${contentCharset}` : null,
					]
						.filter(Boolean)
						.join("; ");

					if (route.hooks?.read?.after) {
						await route.hooks.read.after({
							context: ctx,
							...readFile
						});
					}
		
					return new Response(content, {
						headers: new Headers({
							"Content-Type": contentTypeStr,
							"Content-Disposition": `${contentDisposition ?? "inline"}; filename=${filename}`,
						}),
					});
				},
			),
			deleteFile: createAuthEndpoint(
				"/fs/rm/:path/:key",
				{
					method: "POST"
				},
				async (ctx) => {
					let { path, key } = ctx.params;
		
					if (!path || !key) {
						throw ctx.error("NOT_FOUND");
					}
		
					const route: FileRoute & Record<string, any> = options.router[path];
					key = `${path}/${key}`;
					const file = await ctx.context.adapter.findOne<{
						url: string | undefined;
						metadata: string | undefined;
					}>({
						model: "fileStorage",
						where: [
							{
								field: "key",
								value: key,
							},
						],
						select: ["url", "metadata"],
					});
		
					if (!file) {
						throw ctx.error("NOT_FOUND");
					}
				
					if (route.hooks?.delete?.before) {
						await route.hooks.delete.before({
							context: ctx,
							key,
							metadata: file.metadata ? JSON.parse(file.metadata) : undefined
						})
					}

					await options.provider.delete({
						key,
						url: file.url,
						context: ctx,
						route
					})

					await ctx.context.adapter.delete({
						model: "fileStorage",
						where: [{
							field: "key",
							value: key,
						}],
					});

					if (route.hooks?.delete?.after) {
						await route.hooks.delete.after(ctx);
					}
				},
			),
		} as typeof endpoints,
		schema: mergeSchema(schema, options.schema),
		$ERROR_CODES: ERROR_CODES,
		$Infer: {
			FileRoute: {} as FileRoute<P>,
			FileRouter: {} as FileRouter<P>,
			FileStoragePaths: {} as keyof typeof options.router,
		},
	} satisfies BetterAuthPlugin;
};

export * from "./types";
