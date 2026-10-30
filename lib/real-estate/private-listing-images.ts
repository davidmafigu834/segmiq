import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
/** Separate private bucket: never sign against the existing public marketing bucket. */
export async function signPrivateListingImage(key: string, contentType: string): Promise<string> {
  const bucket = process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME;
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!bucket || bucket === process.env.CLOUDFLARE_R2_BUCKET_NAME || !accountId || !accessKeyId || !secretAccessKey) throw new Error("Private listing image storage is not configured");
  const client = new S3Client({ region: "auto", endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } });
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: contentType }), { expiresIn: 300 });
}
