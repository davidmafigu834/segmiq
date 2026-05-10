import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 credentials are not configured (CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is not configured");
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(getR2Client(), command, { expiresIn: 300 });
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is not configured");
  await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function getPublicUrl(key: string): string {
  const base = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) throw new Error("CLOUDFLARE_R2_PUBLIC_URL is not configured");
  return `${base}/${key}`;
}

export function generateMediaKey(clientId: string, projectId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "jpg";
  return `clients/${clientId}/projects/${projectId}/${Date.now()}.${ext}`;
}

export function generateHeroKey(clientId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "jpg";
  return `clients/${clientId}/hero/${Date.now()}.${ext}`;
}

export function generateTestimonialPhotoKey(clientId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "jpg";
  return `clients/${clientId}/testimonials/${Date.now()}.${ext}`;
}

export function generateOriginalMediaKey(clientId: string, projectId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "jpg";
  return `clients/${clientId}/projects/${projectId}/originals/${Date.now()}.${ext}`;
}

export function generateVideoKey(clientId: string, projectId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "mp4";
  const timestamp = Date.now();
  return `clients/${clientId}/projects/${projectId}/videos/${timestamp}.${ext}`;
}

export async function getObject(key: string): Promise<Buffer> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is not configured");
  const res = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is not configured");
  await getR2Client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}
