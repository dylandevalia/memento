import { useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import type { GalleryFile } from "@/types";

/**
 * Creates and manages URLs for gallery files.
 * - For local files (UploadFile), creates object URLs
 * - For uploaded files (UploadRecord), returns thumbnail URLs
 * Automatically cleans up object URLs when files change or component unmounts.
 */
export function useFileUrls(files: GalleryFile[]) {
  const fileUrls = useMemo(() => {
    const urls = new Map<string, string>();
    const objectUrls: string[] = [];

    files.forEach((file) => {
      if ("rawFile" in file) {
        // Local file - create object URL
        const url = URL.createObjectURL(file.rawFile);
        urls.set(file.name, url);
        objectUrls.push(url);
      } else if ("driveId" in file) {
        // Uploaded file - use thumbnail URL
        urls.set(file.name, api.upload.getThumbnailUrl(file.driveId));
      }
    });

    return { urls, objectUrls };
  }, [files]);

  useEffect(() => {
    return () => {
      // Only revoke object URLs, not thumbnail URLs
      fileUrls.objectUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [fileUrls]);

  return fileUrls.urls;
}
