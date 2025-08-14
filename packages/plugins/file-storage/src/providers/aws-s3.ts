import type { ObjectCannedACL, S3, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createStorageProvider } from ".";
import type { Session, User } from "better-auth";

export type AwsS3ProviderOptions = {
	client: S3 | S3Client;
	bucket?: string;
};

export const awsS3Provider = <O extends AwsS3ProviderOptions>(options: O) => {
	const { client } = options;

	const streamFromChunks = (chunks: Uint8Array[]) => {
		let i = 0;
		return new ReadableStream<Uint8Array>({
			pull(controller) {
				if (i < chunks.length) {
					controller.enqueue(chunks[i]);
					i++;
				} else {
					controller.close();
				}
			},
		});
	};

	return createStorageProvider({
		upload: async ({ part, key, route, context }) => {
			const metadata =
				typeof route.metadata === "function"
					? await route.metadata(context.context.session!)
					: route.metadata;

			const upload = new Upload({
				client,
				params: {
					Bucket: route.bucket || options.bucket,
					Key: key,
					Body: streamFromChunks(part.content),
					ContentType: part.mediaType ?? "application/octet-stream",
					Metadata: metadata,
					ACL: route.ACL ?? "private",
				},
			});

			const response = await upload.done();

			return {
				key: response.Key,
				providerUrl: response.Location,
				eTag: response.ETag,
			};
		},
		delete: async ({ fileURL }) => {},

		$Infer: {
			Options: {} as {
				bucket?: string;
				ACL?: ObjectCannedACL;
				metadata?:
					| Record<string, string>
					| ((session: {
							user: User & Record<string, any>;
							session: Session & Record<string, any>;
					  }) => Record<string, string> | Promise<Record<string, string>>);
			},
		},
	});
};
