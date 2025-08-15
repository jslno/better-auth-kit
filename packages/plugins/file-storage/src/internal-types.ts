import type { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { FileRouter, StorageProvider } from "./types";
import type { TransformPath } from "./utils";

export type UploadReturnType = {
	providerURL?: string;
	fileStorageURL: string;
}[];

export type EndpointPair = {
	upload: ReturnType<
		typeof createAuthEndpoint<
			`/file-storage/upload/${string}`,
			{
				method: "POST";
				use: [typeof sessionMiddleware];
				body: undefined;
				metadata: {
					$Infer: {
						body: FormData;
					};
				};
				requireRequest: true;
				cloneRequest: true;
			},
			UploadReturnType
		>
	>;
};

type PrefixedEndpoints<Path extends string> = {
	[K in keyof EndpointPair as `${Extract<K, string>}${TransformPath<Path>}`]: EndpointPair[K];
};

export type FileRouterToEndpoints<R extends FileRouter> = {
	[K in keyof R & string]: PrefixedEndpoints<K>;
};

export type Merged<T> = {
	[K in keyof T]: T[K];
}[keyof T];
