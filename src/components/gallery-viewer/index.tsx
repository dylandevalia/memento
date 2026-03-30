import ClearIcon from "@mui/icons-material/Clear";
import { IconButton, Skeleton } from "@mui/material";
import clsx from "clsx";
import { useCallback, useState } from "react";
import { TIMEOUTS } from "@/lib/constants";
import type { GalleryFile } from "@/types";
import { useFileUrls } from "./hooks/useFileUrls";
import styles from "./styles.module.css";
import { playCloudPuff } from "./utils/particleAnimation";

interface GalleryViewerProps {
  files: GalleryFile[];
  onFileDelete?: (fileName: string) => void;
}

export function GalleryViewer({ files, onFileDelete }: GalleryViewerProps) {
  const fileUrls = useFileUrls(files);
  const [filesDeleting, setFilesDeleting] = useState<Set<string>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const handleImageLoad = useCallback((fileName: string) => {
    setLoadedImages((prev) => new Set(prev).add(fileName));
  }, []);

  const handleDelete = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>, fileName: string) => {
      setFilesDeleting((prev) => new Set(prev).add(fileName));

      playCloudPuff(
        e.currentTarget,
        styles.thumbnailWrapper || "thumbnailWrapper",
      );

      await new Promise((r) => setTimeout(r, TIMEOUTS.DELETE_ANIMATION_MS));

      setFilesDeleting((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });

      if (onFileDelete) onFileDelete(fileName);
    },
    [onFileDelete],
  );

  return (
    <div className={styles.galleryViewer}>
      {files.map((file) => {
        const progress = "progress" in file ? file.progress : undefined;
        const hasDelete = progress === null && onFileDelete;
        const isLoaded = loadedImages.has(file.name);

        return (
          <div key={file.name} className={styles.thumbnailWrapper}>
            {!isLoaded && (
              <Skeleton
                variant="rectangular"
                width="100%"
                height="100%"
                sx={{
                  aspectRatio: "1 / 1",
                  borderRadius: "4px",
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}
              />
            )}
            <img
              src={fileUrls.get(file.name)}
              alt={file.name}
              onLoad={() => handleImageLoad(file.name)}
              className={clsx(
                styles.thumbnail,
                !isLoaded && styles.loading,
                progress !== null &&
                  progress !== undefined &&
                  progress < 100 &&
                  styles.uploading,
                progress === 100 && styles.uploaded,
                filesDeleting.has(file.name) && styles.deleting,
              )}
            />
            {hasDelete && (
              <IconButton
                size="small"
                className={styles.deleteButton}
                onClick={(e) => handleDelete(e, file.name)}
                disabled={filesDeleting.has(file.name)}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </div>
        );
      })}
    </div>
  );
}
