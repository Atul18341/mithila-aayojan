export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileKey = searchParams.get('key'); // e.g., event-banner/event-1-cover-xxx.webp

  if (!fileKey) {
    return NextResponse.json({ error: 'Missing object target key parameter' }, { status: 400 });
  }

  try {
    const checkCommand = new HeadObjectCommand({
      Bucket: 'mithila-aayojan',
      Key: fileKey,
    });

    // Request metadata details from Cloudflare R2
    const metadata = await r2Client.send(checkCommand);

    return NextResponse.json({
      exists: true,
      message: 'Asset successfully found inside Cloudflare R2 storage layers!',
      details: {
        contentType: metadata.ContentType,
        contentLengthBytes: metadata.ContentLength,
        lastModified: metadata.LastModified,
      },
    });
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return NextResponse.json({ 
        exists: false, 
        error: 'File does not exist in the specified bucket directories.' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      exists: false, 
      error: 'Failed to complete R2 metadata lookup loop.', 
      details: error.message 
    }, { status: 500 });
  }
}