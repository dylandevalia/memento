import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ClearIcon from "@mui/icons-material/Clear";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { CircularProgress, IconButton, Skeleton, Tooltip } from "@mui/material";
import clsx from "clsx";
import { useCallback, useState } from "react";
import { TIMEOUTS } from "@/lib/constants";
import type { GalleryFile, UploadFile } from "@/types";
import { useFileUrls } from "./hooks/useFileUrls";
import styles from "./styles.module.css";
import { playCloudPuff } from "./utils/particleAnimation";

interface GalleryViewerProps {
  files: GalleryFile[];
  onFileDelete?: (fileName: string) => void;
}

function isUploadFile(file: GalleryFile): file is UploadFile {
  return "rawFile" in file;
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
        const progress =
          "progress" in file ? (file.progress ?? undefined) : undefined;
        const uploadFile = isUploadFile(file) ? file : null;
        const status = uploadFile?.status;
        const error = uploadFile?.error;

        const canDelete = status === "idle" && !!onFileDelete;
        const isLoaded = loadedImages.has(file.name);

        return (
          <div
            key={file.name}
            className={clsx(
              styles.thumbnailWrapper,
              filesDeleting.has(file.name) && styles.wrapperDeleting,
            )}
          >
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
                status === "uploading" && styles.uploading,
                status === "done" && styles.uploaded,
                status === "failed" && styles.failed,
                status === "queued" && styles.queued,
                // Fallback for UploadRecord items (no status)
                !status &&
                  progress !== undefined &&
                  progress < 100 &&
                  styles.uploading,
                !status && progress === 100 && styles.uploaded,
                filesDeleting.has(file.name) && styles.deleting,
              )}
            />

            {/* Status overlays */}
            {status === "queued" && (
              <div className={styles.statusOverlay}>
                <HourglassEmptyIcon className={styles.statusIcon} />
              </div>
            )}
            {status === "uploading" && (
              <div className={styles.statusOverlay}>
                <CircularProgress
                  size={24}
                  variant={
                    progress !== null && progress !== undefined
                      ? "determinate"
                      : "indeterminate"
                  }
                  value={progress ?? undefined}
                  sx={{ color: "white" }}
                />
              </div>
            )}
            {status === "done" && (
              <div className={clsx(styles.statusOverlay, styles.doneOverlay)}>
                <CheckCircleOutlineIcon className={styles.statusIcon} />
              </div>
            )}
            {status === "failed" && (
              <Tooltip title={error ?? "Upload failed"} placement="top">
                <div
                  className={clsx(styles.statusOverlay, styles.failedOverlay)}
                >
                  <ErrorOutlineIcon className={styles.statusIcon} />
                </div>
              </Tooltip>
            )}

            {canDelete && (
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
