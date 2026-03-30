import AddIcon from "@mui/icons-material/Add";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import StarIcon from "@mui/icons-material/Star";
import { Button, ButtonBase, LinearProgress } from "@mui/material";
import confetti from "canvas-confetti";
import { useCallback, useMemo, useRef, useState } from "react";
import { useUploadHistory } from "@/hooks/useUploadHistory";
import { api } from "@/lib/api";
import { LIMITS } from "@/lib/constants";
import { handleError } from "@/lib/errorHandler";
import type { UploadFile, UploadResponse } from "@/types";
import { getRandomColor } from "@/utils/material3";
import { GalleryViewer } from "../gallery-viewer";
import styles from "./styles.module.css";

interface FileUploadProps {
  slug: string;
  handleOpenQr: () => void;
}

export function FileUpload({ slug, handleOpenQr }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { addRecords } = useUploadHistory(slug);

  const [selectedFiles, setSelectedFiles] = useState<UploadFile[]>([]);
  const [hasUploaded, setHasUploaded] = useState(false);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);

      setSelectedFiles((prev) => {
        const existingFileNames = new Set(prev.map((f) => f.name));
        const newFiles = fileArray.filter(
          (f) => !existingFileNames.has(f.name),
        );
        return [
          ...prev,
          ...newFiles.map((file) => ({
            name: file.name,
            rawFile: file,
            progress: null,
          })),
        ];
      });

      // Reset the input so the same file can be selected again if needed
      e.target.value = "";
    },
    [],
  );

  const handleFileDelete = useCallback(async (fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const fileSize = useMemo(
    () => selectedFiles.reduce((total, f) => total + f.rawFile.size, 0),
    [selectedFiles],
  );

  const uploadFile = useCallback(
    async (uploadFile: UploadFile): Promise<UploadResponse | null> => {
      try {
        let lastUpdate = 0;
        const res = await api.upload.uploadFileWithProgress(
          slug,
          uploadFile.rawFile,
          (loaded, total) => {
            const progressValue = Math.round((loaded / total) * 99);
            const now = Date.now();
            // Throttle progress updates
            if (
              now - lastUpdate > LIMITS.PROGRESS_THROTTLE_MS ||
              progressValue === 99
            ) {
              lastUpdate = now;
              setSelectedFiles((prev) =>
                prev.map((f) =>
                  f.name === uploadFile.name
                    ? { ...f, progress: progressValue }
                    : f,
                ),
              );
            }
          },
        );

        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.name === uploadFile.name ? { ...f, progress: 100 } : f,
          ),
        );

        return res;
      } catch (error) {
        handleError(error, `FileUpload:uploadFile:${uploadFile.rawFile.name}`);
        return null;
      }
    },
    [slug],
  );

  const uploadFiles = useCallback(async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setHasUploaded(false);

    const queue = [...selectedFiles];
    const activeUploads: Promise<UploadResponse | null>[] = [];
    const uploadResults: UploadResponse[] = [];

    while (queue.length > 0 || activeUploads.length > 0) {
      // Fill up to concurrent limit
      while (
        activeUploads.length < LIMITS.CONCURRENT_UPLOADS &&
        queue.length > 0
      ) {
        const file = queue.shift();
        if (file) {
          const uploadPromise = uploadFile(file).then((result) => {
            const index = activeUploads.indexOf(uploadPromise);
            if (index > -1) activeUploads.splice(index, 1);
            if (result) uploadResults.push(result);
            return result;
          });
          activeUploads.push(uploadPromise);
        }
      }

      // Wait for at least one upload to complete
      if (activeUploads.length > 0) {
        await Promise.race(activeUploads);
      }
    }

    // Build history records from upload results
    const historyRecords = uploadResults.flatMap((result) =>
      result.files.map((file) => ({
        name: file.name,
        driveId: file.driveId,
        uploadedAt: new Date().toISOString(),
      })),
    );

    setSelectedFiles([]);
    addRecords(historyRecords);
    setHasUploaded(true);
  }, [selectedFiles, uploadFile, addRecords]);

  /* Render */

  const iconColor = useMemo(() => getRandomColor(700), []);
  const addMoreBtnColor = useMemo(() => getRandomColor(700), []);
  const progressBarColor = useMemo(() => getRandomColor(700), []);
  const shareBtnColor = useMemo(() => getRandomColor(700), []);

  function renderNoSelectedFiles() {
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

  function renderFileList() {
    const countMessage = `${selectedFiles.length} ${
      selectedFiles.length === 1 ? "memory" : "memories"
    } ready`;

    return (
      <div className={styles.galleryContent}>
        <div className={styles.galleryHeader}>
          <div className={styles.uploadInfo}>
            <p>{countMessage}</p>
            <Button
              type="button"
              size="small"
              startIcon={<AddIcon />}
              style={{ color: addMoreBtnColor }}
              onClick={() => inputRef.current?.click()}
            >
              add more
            </Button>
          </div>

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
        </div>

        <GalleryViewer files={selectedFiles} onFileDelete={handleFileDelete} />

        <Button
          variant="contained"
          type="button"
          onClick={() => uploadFiles()}
          startIcon={<StarIcon />}
          endIcon={<StarIcon />}
          className={styles.shareButton}
          sx={{
            color: "white",
            background: shareBtnColor,
          }}
        >
          preserve memories
        </Button>
      </div>
    );
  }

  function renderUploaded() {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    return (
      <div className={styles.uploaded}>
        <h2>memories preserved!</h2>
        <p>thanks for contributing your memories to the celebration</p>

        <div>
          <Button
            variant="outlined"
            // startIcon={<AddIcon />}
            onClick={() => setHasUploaded(false)}
            style={{ color: addMoreBtnColor, borderColor: addMoreBtnColor }}
          >
            preserve more
          </Button>

          <Button
            variant="outlined"
            startIcon={<QrCode2Icon />}
            onClick={() => handleOpenQr()}
            style={{ color: shareBtnColor, borderColor: shareBtnColor }}
            sx={{ ml: 2 }}
          >
            share
          </Button>
        </div>
      </div>
    );
  }

  function renderContent() {
    if (hasUploaded) {
      return renderUploaded();
    }

    if (selectedFiles.length) {
      return renderFileList();
    }

    return renderNoSelectedFiles();
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
