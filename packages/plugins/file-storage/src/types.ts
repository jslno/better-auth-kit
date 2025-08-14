import type { MultipartPart } from "@remix-run/multipart-parser";
import type { GenericEndpointContext, Session, User } from "better-auth";

export type StorageProvider<O = {}> = {
	upload: (params: {
		part: MultipartPart;
		key: string;
		route: FileRoute & O;
		context: GenericEndpointContext;
	}) => Promise<{
		key?: string;
		providerUrl?: string;
		eTag?: string;
	}>;

	delete: (params: {
		fileURL: string;
	}) => Promise<void>;

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
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => number | Promise<number>);
	/**
	 * Maximum file size in bytes
	 * @default 5_242_880 (5MB)
	 */
	maxSize?:
		| number
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => number | Promise<number>);

	/**
	 * Maximum header size in bytes
	 * @default 2_048 (2KiB)
	 */
	maxHeaderSize?:
		| number
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => number | Promise<number>);

	/**
	 * Allowed file MIME types
	 * By default, all MIME types are allowed. However, we recommend specifying the allowed types to avoid unexpected or unwanted file types.
	 */
	allowedTypes?:
		| string[]
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => string[] | Promise<string[]>);

	/**
	 * Function to determine if a user/request is allowed to upload a file.
	 */
	canUpload?: (
		session: {
			user: User & Record<string, any>;
			session: Session & Record<string, any>;
		} | null,
		request: Request,
	) => boolean | Promise<boolean>;

	/**
	 * Function to determine if a user/request is allowed to delete a file.
	 */
	canDelete?: (
		session: {
			user: User & Record<string, any>;
			session: Session & Record<string, any>;
		} | null,
		request: Request,
	) => boolean | Promise<boolean>;

	/**
	 * Callback function that gets executed server-side when an file is uploaded
	 * @param params Object containing the file entry and user
	 */
	onFileUploaded?: (params: {
		file: {
			url: string;
			key: string;
		};
		user: User & Record<string, any>;
	}) => void | Promise<void>;
} & (P extends { $Infer?: { Options?: infer O } } ? O : {});
