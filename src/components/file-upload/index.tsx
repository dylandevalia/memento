import AddIcon from "@mui/icons-material/Add";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import { Button, ButtonBase, LinearProgress } from "@mui/material";
import confetti from "canvas-confetti";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUploadHistory } from "@/hooks/useUploadHistory";
import { api } from "@/lib/api";
import { LIMITS } from "@/lib/constants";
import { handleError } from "@/lib/errorHandler";
import type { UploadFile, UploadResponse, UploadStatus } from "@/types";
import { getRandomColor } from "@/utils/material3";
import { GalleryViewer } from "../gallery-viewer";
import styles from "./styles.module.css";

interface FileUploadProps {
  slug: string;
  handleOpenQr: () => void;
}

type UploadPhase = "idle" | "uploading" | "complete";

export function FileUpload({ slug, handleOpenQr }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { addRecords } = useUploadHistory(slug);

  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");

  const stats = useMemo(() => {
    const done = selectedFiles.filter((f) => f.status === "done").length;
    const failed = selectedFiles.filter((f) => f.status === "failed").length;
    const total = selectedFiles.length;
    return { done, failed, total };
  }, [selectedFiles]);

  // Fire confetti once on full success
  useEffect(() => {
    if (uploadPhase === "complete" && stats.failed === 0 && stats.done > 0) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }, [uploadPhase, stats.failed, stats.done]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const fileArray = Array.from(files);
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const newFiles = fileArray
          .filter((f) => !existingNames.has(f.name))
          .map((file) => ({
            name: file.name,
            rawFile: file,
            progress: null,
            status: "idle" as UploadStatus,
          }));
        return [...prev, ...newFiles];
      });
      e.target.value = "";
    },
    [],
  );

  const handleFileDelete = useCallback((fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const fileSize = useMemo(
    () => selectedFiles.reduce((total, f) => total + f.rawFile.size, 0),
    [selectedFiles],
  );

  const uploadSingleFile = useCallback(
    async (file: UploadFile): Promise<UploadResponse | null> => {
      setSelectedFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, status: "uploading" as UploadStatus }
            : f,
        ),
      );
      try {
        let lastUpdate = 0;
        const res = await api.upload.uploadFileWithProgress(
          slug,
          file.rawFile,
          (loaded, total) => {
            const progressValue = Math.round((loaded / total) * 99);
            const now = Date.now();
            if (
              now - lastUpdate > LIMITS.PROGRESS_THROTTLE_MS ||
              progressValue === 99
            ) {
              lastUpdate = now;
              setSelectedFiles((prev) =>
                prev.map((f) =>
                  f.name === file.name ? { ...f, progress: progressValue } : f,
                ),
              );
            }
          },
        );
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? {
                  ...f,
                  status: "done" as UploadStatus,
                  progress: 100,
                  driveId: res.files[0]?.driveId,
                }
              : f,
          ),
        );
        return res;
      } catch (error) {
        handleError(error, `FileUpload:upload:${file.name}`);
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.name === file.name
              ? {
                  ...f,
                  status: "failed" as UploadStatus,
                  error: (error as Error).message,
                }
              : f,
          ),
        );
        return null;
      }
    },
    [slug],
  );

  const runQueue = useCallback(
    async (queue: UploadFile[]): Promise<UploadResponse[]> => {
      if (queue.length === 0) return [];

      // Mark all queued files as 'queued' in the UI
      setSelectedFiles((prev) =>
        prev.map((f) =>
          queue.some((qf) => qf.name === f.name)
            ? { ...f, status: "queued" as UploadStatus }
            : f,
        ),
      );

      const remaining = [...queue];
      const active: Promise<UploadResponse | null>[] = [];
      const results: UploadResponse[] = [];

      while (remaining.length > 0 || active.length > 0) {
        while (
          active.length < LIMITS.CONCURRENT_UPLOADS &&
          remaining.length > 0
        ) {
          const file = remaining.shift()!;
          const p: Promise<UploadResponse | null> = uploadSingleFile(file).then(
            (result) => {
              const idx = active.indexOf(p);
              if (idx > -1) active.splice(idx, 1);
              if (result) results.push(result);
              return result;
            },
          );
          active.push(p);
        }
        if (active.length > 0) await Promise.race(active);
      }

      return results;
    },
    [uploadSingleFile],
  );

  const uploadFiles = useCallback(async () => {
    const toUpload = selectedFiles.filter((f) => f.status === "idle");
    if (toUpload.length === 0) return;

    setUploadPhase("uploading");
    const results = await runQueue(toUpload);

    const historyRecords = results.flatMap((r) =>
      r.files.map((f) => ({
        name: f.name,
        driveId: f.driveId,
        uploadedAt: new Date().toISOString(),
      })),
    );
    if (historyRecords.length > 0) addRecords(historyRecords);

    setUploadPhase("complete");
  }, [selectedFiles, runQueue, addRecords]);

  const retryFailed = useCallback(async () => {
    const failed = selectedFiles.filter((f) => f.status === "failed");
    if (failed.length === 0) return;

    setUploadPhase("uploading");
    const results = await runQueue(failed);

    const historyRecords = results.flatMap((r) =>
      r.files.map((f) => ({
        name: f.name,
        driveId: f.driveId,
        uploadedAt: new Date().toISOString(),
      })),
    );
    if (historyRecords.length > 0) addRecords(historyRecords);

    setUploadPhase("complete");
  }, [selectedFiles, runQueue, addRecords]);

  const handlePreserveMore = useCallback(() => {
    setSelectedFiles([]);
    setUploadPhase("idle");
  }, []);

  /* Colours — stable across renders */
  const iconColor = useMemo(() => getRandomColor(700), []);
  const addMoreBtnColor = useMemo(() => getRandomColor(700), []);
  const progressBarColor = useMemo(() => getRandomColor(700), []);
  const shareBtnColor = useMemo(() => getRandomColor(700), []);
  const retryBtnColor = useMemo(() => getRandomColor(700), []);

  function renderDropZone() {
    return (
      <ButtonBase
        component="button"
        className={styles.uploadContainer}
        onClick={() => inputRef.current?.click()}
      >
        <div className={styles.uploadContent}>
          <PhotoCameraOutlinedIcon
            className={styles.uploadIcon}
            style={{ color: iconColor }}
          />
          <div className={styles.uploadTitle}>add your memories</div>
          <div className={styles.uploadSubtitle}>
            tap to add photos & videos
          </div>
        </div>
      </ButtonBase>
    );
  }

  function renderFileQueue() {
    const isUploading = uploadPhase === "uploading";
    const isComplete = uploadPhase === "complete";

    let headerText: string;
    if (isUploading) {
      headerText = `${stats.done} / ${stats.total} preserved`;
    } else if (isComplete) {
      headerText =
        stats.failed > 0
          ? `${stats.done} preserved · ${stats.failed} failed`
          : `${stats.done} ${stats.done === 1 ? "memory" : "memories"} preserved!`;
    } else {
      headerText = `${selectedFiles.length} ${selectedFiles.length === 1 ? "memory" : "memories"} ready`;
    }

    return (
      <div className={styles.galleryContent}>
        <div className={styles.galleryHeader}>
          <div className={styles.uploadInfo}>
            <p>{headerText}</p>
            {!isUploading && !isComplete && (
              <Button
                type="button"
                size="small"
                startIcon={<AddIcon />}
                style={{ color: addMoreBtnColor }}
                onClick={() => inputRef.current?.click()}
              >
                add more
              </Button>
            )}
          </div>

          {!isUploading && !isComplete && (
            <div className={styles.fileSizeInfo}>
              <div>
                <span>{(fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                <span>2 GB max</span>
              </div>
              <LinearProgress
                variant="determinate"
                value={(fileSize / (2 * 1024 * 1024 * 1024)) * 100}
                sx={{
                  width: "100%",
                  height: 4,
                  backgroundColor: "rgb(var(--mui-grey-200) / 20%)",
                  "& .MuiLinearProgress-bar": {
                    background: progressBarColor,
                  },
                }}
              />
            </div>
          )}

          {isUploading && (
            <LinearProgress
              variant="determinate"
              value={stats.total > 0 ? (stats.done / stats.total) * 100 : 0}
              sx={{
                width: "100%",
                height: 6,
                borderRadius: 3,
                backgroundColor: "rgb(var(--mui-grey-200) / 20%)",
                "& .MuiLinearProgress-bar": {
                  background: progressBarColor,
                  borderRadius: 3,
                },
              }}
            />
          )}
        </div>

        <GalleryViewer
          files={selectedFiles}
          onFileDelete={
            !isUploading && !isComplete ? handleFileDelete : undefined
          }
        />

        {!isUploading && !isComplete && (
          <Button
            variant="contained"
            type="button"
            onClick={() => uploadFiles()}
            startIcon={<StarIcon />}
            endIcon={<StarIcon />}
            className={styles.shareButton}
            sx={{ color: "white", background: shareBtnColor }}
          >
            preserve memories
          </Button>
        )}

        {isComplete && (
          <div className={styles.completeActions}>
            {stats.failed > 0 && (
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={retryFailed}
                style={{
                  color: retryBtnColor,
                  borderColor: retryBtnColor,
                }}
              >
                retry {stats.failed} failed
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={handlePreserveMore}
              style={{
                color: addMoreBtnColor,
                borderColor: addMoreBtnColor,
              }}
            >
              preserve more
            </Button>
            <Button
              variant="outlined"
              startIcon={<QrCode2Icon />}
              onClick={() => handleOpenQr()}
              style={{
                color: shareBtnColor,
                borderColor: shareBtnColor,
              }}
            >
              share
            </Button>
          </div>
        )}
      </div>
    );
  }

  function renderSuccess() {
    return (
      <div className={styles.uploaded}>
        <h2>memories preserved!</h2>
        <p>thanks for contributing your memories to the celebration</p>
        <div>
          <Button
            variant="outlined"
            onClick={handlePreserveMore}
            style={{
              color: addMoreBtnColor,
              borderColor: addMoreBtnColor,
            }}
          >
            preserve more
          </Button>
          <Button
            variant="outlined"
            startIcon={<QrCode2Icon />}
            onClick={() => handleOpenQr()}
            style={{
              color: shareBtnColor,
              borderColor: shareBtnColor,
            }}
            sx={{ ml: 2 }}
          >
            share
          </Button>
        </div>
      </div>
    );
  }

  function renderContent() {
    if (uploadPhase === "complete" && stats.failed === 0 && stats.done > 0) {
      return renderSuccess();
    }
    if (selectedFiles.length > 0 || uploadPhase !== "idle") {
      return renderFileQueue();
    }
    return renderDropZone();
  }

  return (
    <section className={styles.fileUpload}>
      {renderContent()}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept="image/*,video/*"
        onChange={handleFileChange}
      />
    </section>
  );
}
