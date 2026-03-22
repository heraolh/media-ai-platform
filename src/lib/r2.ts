import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string
): Promise<string> {
  // 确保 body 是 Buffer 或 Uint8Array
  let uploadBody: Buffer | Uint8Array;
  if (body instanceof ArrayBuffer) {
    uploadBody = Buffer.from(body);
  } else {
    uploadBody = body;
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: uploadBody,
      ContentType: contentType,
    })
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
