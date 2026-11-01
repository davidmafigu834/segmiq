import { createHash, randomUUID } from "crypto";
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const PRIVATE_LISTING_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const PRIVATE_PHOTO_KEY = /^clients\/[^/]+\/listings\/[^/]+\/photos\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|avif)$/i;

export type PrivateListingImageType = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/avif"; ext: "jpg" | "png" | "webp" | "avif" };
export type PrivateListingImageDetection = { ok: true } & PrivateListingImageType | { ok: false; code: "EMPTY" | "TOO_LARGE" | "UNSUPPORTED" };

function ascii(bytes: Uint8Array, start: number, end: number): string {
  let text = "";
  for (let index = start; index < end && index < bytes.length; index += 1) text += String.fromCharCode(bytes[index]);
  return text;
}

/** Signature check for a phone photograph. HEIC is rejected; the client sends JPEG, PNG, WebP or AVIF. */
export function detectPrivateListingImage(bytes: Uint8Array): PrivateListingImageDetection {
  if (bytes.length === 0) return { ok: false, code: "EMPTY" };
  if (bytes.length > PRIVATE_LISTING_IMAGE_MAX_BYTES) return { ok: false, code: "TOO_LARGE" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ok: true, mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return { ok: true, mime: "image/png", ext: "png" };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return { ok: true, mime: "image/webp", ext: "webp" };
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12))) return { ok: true, mime: "image/avif", ext: "avif" };
  return { ok: false, code: "UNSUPPORTED" };
}

export function privateListingPhotoFileName(idempotencyKey: string | null, ext: PrivateListingImageType["ext"]): string {
  const base = idempotencyKey && idempotencyKey.length >= 8 && idempotencyKey.length <= 200
    ? createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32)
    : randomUUID().replace(/-/g, "");
  return `${base}.${ext}`;
}

export function isPrivateListingImageStorageConfigured(): boolean {
  const bucket = process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME;
  return Boolean(bucket && bucket !== process.env.CLOUDFLARE_R2_BUCKET_NAME && process.env.CLOUDFLARE_R2_ACCOUNT_ID && process.env.CLOUDFLARE_R2_ACCESS_KEY_ID && process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
}

/** Stores bytes in the private listing bucket. The public marketing bucket is refused. */
export async function putPrivateListingImage(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!PRIVATE_PHOTO_KEY.test(key)) throw new Error("Refusing a listing image outside the private photo prefix");
  const bucket = process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME;
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!bucket || bucket === process.env.CLOUDFLARE_R2_BUCKET_NAME || !accountId || !accessKeyId || !secretAccessKey) throw new Error("Private listing image storage is not configured");
  const client = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, no-store" }));
}

/** Separate private bucket: never sign against the existing public marketing bucket. */
export async function signPrivateListingImage(key: string, contentType: string): Promise<string> {
  const bucket = process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME;
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!bucket || bucket === process.env.CLOUDFLARE_R2_BUCKET_NAME || !accountId || !accessKeyId || !secretAccessKey) throw new Error("Private listing image storage is not configured");
  const client = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  const metadata = await client.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
  if (!validPrivateImageMetadata(metadata.ContentLength,metadata.ContentType,contentType)) throw new Error("Listing image metadata is invalid");
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: contentType }), { expiresIn: 300 });
}

export function validPrivateImageMetadata(size: number | undefined, storedType: string | undefined, expectedType: string): boolean {
 return typeof size === "number" && size > 0 && size <= 20*1024*1024 && storedType === expectedType && ["image/jpeg","image/png","image/webp","image/avif"].includes(expectedType);
}
