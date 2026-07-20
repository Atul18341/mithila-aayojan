export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

type RouteContext = {
  params: Promise<{ id: string }>;
};
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const formData = await request.formData();
    const { id } = await context.params;
    const eventId = id;
    
    const coverFile = formData.get('cover') as File | null;
    const posterFile = formData.get('poster') as File | null;
    
    // Explicitly target your bucket identifier
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicBaseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    const updatedUrls: { coverUrl?: string; posterUrl?: string } = {};

    // 1. Process and upload Event Cover Banner if present
    if (coverFile) {
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer());
      // Re-architected key mapping directly into your event-banner folder path
      const coverKey = `event-banner/event-${eventId}-cover-${Date.now()}.webp`;
      
      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: coverKey,
          Body: coverBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000', // Cache at edge CDN nodes for 1 year
        })
      );
      // Assembles clean address string: https://pub-f6007cb4960a4dd98733c35982b7b8cd.r2.dev/event-banner/...
      updatedUrls.coverUrl = `${publicBaseUrl}/${coverKey}`;
    }

    // 2. Process and upload Event Poster graphic if present
    if (posterFile) {
      const posterBuffer = Buffer.from(await posterFile.arrayBuffer());
      // Re-architected key mapping directly into your event-cover-image folder path
      const posterKey = `event-cover-image/event-${eventId}-poster-${Date.now()}.webp`;
      
      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: posterKey,
          Body: posterBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000',
        })
      );
      // Assembles clean address string: https://pub-f6007cb4960a4dd98733c35982b7b8cd.r2.dev/event-cover-image/...
      updatedUrls.posterUrl = `${publicBaseUrl}/${posterKey}`;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Media assets synchronized and pushed to Cloudflare R2 directories.',
      ...updatedUrls 
    });

  } catch (error) {
    console.error('Cloudflare R2 sync pipeline failure:', error);
    return NextResponse.json({ success: false, error: 'Upload transaction failed' }, { status: 500 });
  }
}