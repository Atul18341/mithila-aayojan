import { S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error(
    `❌ R2 Configuration Mismatch: One or more environment parameters are missing.\n` +
    `Current Account ID: ${accountId ? 'Found' : 'MISSING'}\n` +
    `Please check your .env.local target variables.`
  );
}
export const r2Client = new S3Client({
  region: 'auto', // Cloudflare R2 automatically routes regions optimized by topology
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});