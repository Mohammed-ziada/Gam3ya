import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function config() {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET || "assets";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Neon Object Storage environment variables are incomplete");
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function client() {
  const value = config();
  return new S3Client({
    endpoint: value.endpoint,
    region: value.region,
    forcePathStyle: true,
    credentials: { accessKeyId: value.accessKeyId, secretAccessKey: value.secretAccessKey },
  });
}

export async function uploadPrivateFile(key: string, body: Uint8Array, contentType: string) {
  const value = config();
  await client().send(new PutObjectCommand({ Bucket: value.bucket, Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function signedProofUrl(key: string) {
  const value = config();
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: value.bucket, Key: key }), { expiresIn: 300 });
}
