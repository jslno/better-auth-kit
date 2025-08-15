import type { MultipartPart } from "@remix-run/multipart-parser";
import type {
	GenericEndpointContext,
	InferOptionSchema,
	Session,
	User,
} from "better-auth";
import type { UploadReturnType } from "./internal-types";
import type { schema } from "./schema";

export type StorageProvider<O = {}> = {
	upload: (params: {
		part: MultipartPart;
		key: string;
		route: FileRoute & O;
		context: GenericEndpointContext;
	}) => Promise<{
		key?: string;
		providerURL?: string;
		eTag?: string;
	}>;

	delete: (params: {
		key: string;
		url: string | undefined;
		route: FileRoute & O;
		context: GenericEndpointContext;
	}) => Promise<void>;

	read: (params: {
		key: string;
		url: string | undefined;
		route: FileRoute & O;
		context: GenericEndpointContext;
	}) => Promise<{
		eTag?: string;
		contentType?: string;
		contentCharset?: string;
		contentLength?: number;
		contentDisposition?: "inline" | "attachment";
		content: any;
	}>;

	$Infer?: {
		Options?: O;
	};
};

export type FileStorageOptions<
	P extends StorageProvider<any>,
	R extends FileRouter<P>,
> = {
	/**
	 * Storage provider used for file actions
	 */
	provider: P;

	/**
	 * An object of routes which define the rules of file uploads.
	 */
	router: R;

	/**
	 * Custom schema for the file storage plugin
	 */
	schema?: InferOptionSchema<typeof schema>;
};

export type FileRouter<P extends StorageProvider<any> = StorageProvider> = {
	[key: string]: FileRoute<P>;
};

export type FileRoute<P extends StorageProvider<any> = StorageProvider> = {
	/**
	 * Maximum amount of files to upload
	 * @default Number.POSITIVE_INFINITY
	 */
	maxFiles?:
		| number
		| ((
				session: {
					user: User & Record<string, any>;
					session: Session & Record<string, any>;
				} | null,
		  ) => number | Promise<number>);
	/**
	 * Maximum file size in bytes
	 * @default 5_242_880 (5MB)
	 */
	maxSize?:
		| number
		| ((
				session: {
					user: User & Record<string, any>;
					session: Session & Record<string, any>;
				} | null,
		  ) => number | Promise<number>);

	/**
	 * Maximum header size in bytes
	 * @default 2_048 (2KiB)
	 */
	maxHeaderSize?:
		| number
		| ((
				session: {
					user: User & Record<string, any>;
					session: Session & Record<string, any>;
				} | null,
		  ) => number | Promise<number>);

	/**
	 * Allowed file MIME types
	 * By default, all MIME types are allowed. However, we recommend specifying the allowed types to avoid unexpected or unwanted file types.
	 */
	allowedTypes?:
		| string[]
		| ((
				session: {
					user: User & Record<string, any>;
					session: Session & Record<string, any>;
				} | null,
		  ) => string[] | Promise<string[]>);

	metadata?:
		| Record<string, any>
		| ((
				session: {
					user: User & Record<string, any>;
					session: Session & Record<string, any>;
				} | null,
		  ) => Record<string, any> | Promise<Record<string, any>>);

	/**
	 * Callback function that gets executed server-side when an file is uploaded
	 * @param params Object containing the file entry and user
	 */
	onFileUploaded?: (params: {
		file: Awaited<ReturnType<StorageProvider["upload"]>> & {
			metadata: Record<string, any>;
			fileStorageURL: string;
		};
		ctx: GenericEndpointContext;
	}) => void | Promise<void>;

	hooks?: {
		upload?: {
			before?: (
				ctx: GenericEndpointContext,
			) =>
				| (Partial<FileRoute<P>> | void)
				| Promise<Partial<FileRoute<P>> | void>;
			after?: (ctx: {
				context: GenericEndpointContext;
				uploadedFiles: (UploadReturnType[number] & {
					metadata?: Record<string, any>;
				})[];
			}) => void | Promise<void>;
		};

		delete?: {
			before?: (ctx: {
				context: GenericEndpointContext;
				key: string;
				metadata: Record<string, any> | undefined;
			}) => void | Promise<void>;
			after?: (ctx: GenericEndpointContext) => void | Promise<void>;
		};
		read?: {
			before?: (ctx: {
				context: GenericEndpointContext;
				key: string;
				metadata: Record<string, any> | undefined;
			}) => void | Promise<void>;
			after?: (
				ctx: {
					context: GenericEndpointContext;
				} & Awaited<ReturnType<StorageProvider["read"]>>,
			) => void | Promise<void>;
		};
	};
} & (P extends { $Infer?: { Options?: infer O } } ? O : {});
