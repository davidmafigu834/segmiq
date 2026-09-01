import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function isR2Configured(): boolean {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicUrl);
}

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

export async function generatePresignedDownloadUrl(
  key: string,
  filename: string,
  contentType = "image/jpeg"
): Promise<string> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is not configured");
  const safeName = filename.replace(/["\\]/g, "");
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
  });
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

export function generateCapabilityAssetKey(clientId: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "jpg";
  return `clients/${clientId}/capability/${Date.now()}.${ext}`;
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

export function generateBlogCoverKey(filename: string): string {
  const ext = filename.split(".").pop() ?? "jpg";
  return `blog/covers/${Date.now()}.${ext}`;
}

export function generateVideoKey(clientId: string, projectId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "mp4";
  const timestamp = Date.now();
  return `clients/${clientId}/projects/${projectId}/videos/${timestamp}.${ext}`;
}

export function generateWhatsAppOutboundKey(
  clientId: string,
  leadId: string,
  filename: string
): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "bin";
  return `whatsapp/${clientId}/outbound/${leadId}/${Date.now()}.${safeExt}`;
}

export async function getObject(key: string): Promise<Buffer> {
  const result = await getObjectWithMeta(key);
  return result.body;
}

export async function getObjectWithMeta(
  key: string
): Promise<{ body: Buffer; contentType: string | null }> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is not configured");
  const res = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return {
    body: Buffer.from(await res.Body!.transformToByteArray()),
    contentType: typeof res.ContentType === "string" ? res.ContentType : null,
  };
}

export function generateComplianceDocKey(
  clientId: string,
  caseId: string,
  filename: string
): string {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `clients/${clientId}/compliance/${caseId}/${Date.now()}.${ext}`;
}

/** Private company document version storage (SegmiQ Documents module). */
export function generateDocumentVersionKey(
  clientId: string,
  documentId: string,
  versionId: string,
  filename: string
): string {
  const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `clients/${clientId}/documents/${documentId}/versions/${versionId}/${Date.now()}.${ext}`;
}

export function isDocumentStorageKeyForClient(clientId: string, storageKey: string): boolean {
  const prefix = `clients/${clientId}/documents/`;
  return storageKey.startsWith(prefix) && !storageKey.includes("..");
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  options?: { contentDisposition?: string; cacheControl?: string }
): Promise<void> {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  if (!bucket) throw new Error("CLOUDFLARE_R2_BUCKET_NAME is not configured");
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: options?.contentDisposition,
      CacheControl: options?.cacheControl,
    })
  );
}
