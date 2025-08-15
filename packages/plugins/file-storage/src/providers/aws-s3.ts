import {
	DeleteObjectCommand,
	GetObjectCommand,
	type ObjectCannedACL,
	type S3,
	type S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createStorageProvider } from ".";

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
		upload: async ({ part, key, route }) => {
			const upload = new Upload({
				client,
				params: {
					Bucket: route.bucket || options.bucket,
					Key: key,
					Body: streamFromChunks(part.content),
					ContentType: part.mediaType ?? "application/octet-stream",
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
		delete: async ({ key, url, route }) => {
			const command = new DeleteObjectCommand({
				Bucket: route.bucket || options.bucket,
				Key: key,
			})
			
			await client.send(command);
		},
		read: async ({ key, route }) => {
			const command = new GetObjectCommand({
				Bucket: route.bucket || options.bucket,
				Key: key,
			});
			const result = await client.send(command);

			return {
				metadata: result.Metadata,
				eTag: result.ETag,
				contentType: result.ContentType,
				contentLength: result.ContentLength,
				contentCharset: result.ContentEncoding,
				content: result.Body?.transformToWebStream(),
			};
		},

		$Infer: {
			Options: {} as {
				bucket?: string;
				ACL?: ObjectCannedACL;
			},
		},
	});
};
