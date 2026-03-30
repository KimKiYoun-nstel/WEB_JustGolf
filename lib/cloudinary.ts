/**
 * Cloudinary 서버 측 유틸리티
 * - Signed Upload용 서명 생성
 * - 업로드된 이미지 삭제
 */
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

/** Cloudinary Signed Upload 서명 생성 */
export function generateUploadSignature(params: {
  folder: string;
  public_id: string;
  timestamp: number;
}): string {
  return cloudinary.utils.api_sign_request(
    {
      folder: params.folder,
      public_id: params.public_id,
      timestamp: params.timestamp,
    },
    process.env.CLOUDINARY_API_SECRET!
  );
}

/** Cloudinary에서 이미지 삭제 */
export async function deleteCloudinaryImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

/**
 * Cloudinary 썸네일 URL 생성
 * - 최대 800px 너비, 자동 포맷/품질 최적화
 */
export function buildThumbnailUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    transformation: [
      { width: 800, crop: "limit" },
      { fetch_format: "auto", quality: "auto" },
    ],
  });
}
