import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ClearIcon from "@mui/icons-material/Clear";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { CircularProgress, IconButton, Skeleton, Tooltip } from "@mui/material";
import clsx from "clsx";
import { useCallback, useState } from "react";
import { useLazyImage } from "@/hooks/useLazyImage";
import { TIMEOUTS } from "@/lib/constants";
import type { GalleryFile, UploadFile } from "@/types";
import { useFileUrls } from "./hooks/useFileUrls";
import styles from "./styles.module.css";
import { playCloudPuff } from "./utils/particleAnimation";

interface GalleryViewerProps {
  files: GalleryFile[];
  onFileDelete?: (fileName: string) => void;
}

interface ThumbnailItemProps {
  file: GalleryFile;
  url: string | undefined;
  onFileDelete?: (fileName: string) => void;
}

/**
 * Single thumbnail cell. Owns its own lazy-load, delete-animation, and status
 * overlay state so the parent GalleryViewer stays lean.
 *
 * Drive thumbnail URLs are only fetched once the cell enters the viewport.
 * Local object URLs (files selected but not yet uploaded) always load
 * immediately so the user sees their selection straight away.
 */
function ThumbnailItem({ file, url, onFileDelete }: ThumbnailItemProps) {
  const isUploadFile = "rawFile" in file;
  const uploadFile = isUploadFile ? (file as UploadFile) : null;

  const status = uploadFile?.status;
  const error = uploadFile?.error;
  const progress =
    "progress" in file ? (file.progress ?? undefined) : undefined;

  // Local object URLs must load immediately (user just selected the file).
  // Drive thumbnail URLs are lazy — only fetch when the cell is in view.
  const { imgRef, isInView, isLoaded, handleLoad } = useLazyImage();
  const shouldLoad = isUploadFile || isInView;

  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = status === "idle" && !!onFileDelete;

  const handleDelete = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsDeleting(true);
      playCloudPuff(
        e.currentTarget,
        styles.thumbnailWrapper || "thumbnailWrapper",
      );
      await new Promise((r) => setTimeout(r, TIMEOUTS.DELETE_ANIMATION_MS));
      onFileDelete?.(file.name);
      // Parent removes this item from the list, so the component unmounts.
      // No need to reset isDeleting.
    },
    [onFileDelete, file.name],
  );

  return (
    <div
      className={clsx(
        styles.thumbnailWrapper,
        isDeleting && styles.wrapperDeleting,
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
        ref={imgRef}
        src={shouldLoad ? url : undefined}
        alt={file.name}
        onLoad={handleLoad}
        className={clsx(
          styles.thumbnail,
          !isLoaded && styles.loading,
          status === "uploading" && styles.uploading,
          status === "done" && styles.uploaded,
          status === "failed" && styles.failed,
          status === "queued" && styles.queued,
          // Fallback for UploadRecord items (no status field)
          !status &&
            progress !== undefined &&
            progress < 100 &&
            styles.uploading,
          !status && progress === 100 && styles.uploaded,
          isDeleting && styles.deleting,
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
          <div className={clsx(styles.statusOverlay, styles.failedOverlay)}>
            <ErrorOutlineIcon className={styles.statusIcon} />
          </div>
        </Tooltip>
      )}

      {canDelete && (
        <IconButton
          size="small"
          className={styles.deleteButton}
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <ClearIcon fontSize="small" />
        </IconButton>
      )}
    </div>
  );
}

export function GalleryViewer({ files, onFileDelete }: GalleryViewerProps) {
  const fileUrls = useFileUrls(files);

  return (
    <div className={styles.galleryViewer}>
      {files.map((file) => (
        <ThumbnailItem
          key={file.name}
          file={file}
          url={fileUrls.get(file.name)}
          onFileDelete={onFileDelete}
        />
      ))}
    </div>
  );
}
