import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ValidateTokenResponse } from "../types";

type Status = "validating" | "invalid" | "ready" | "uploading" | "done";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface UploadRecord {
  name: string;
  driveId: string;
  uploadedAt: string; // ISO 8601
}

function storageKey(slug: string) {
  return `memento:uploads:${slug}`;
}

function loadHistory(slug: string): UploadRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as UploadRecord[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(slug: string, records: UploadRecord[]) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(records));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function UploadHistory({
  history,
  deletingIds,
  onDelete,
}: {
  history: UploadRecord[];
  deletingIds: Set<string>;
  onDelete: (driveId: string) => void;
}) {
  if (history.length === 0) return null;

  return (
    <Box sx={{ px: 2, pb: 6 }}>
      {/* Ornamental divider */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          my: 4,
        }}
      >
        <Box
          sx={{
            flex: 1,
            height: "1px",
            bgcolor: "divider",
          }}
        />
        <Typography
          sx={{
            fontSize: "0.6rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "text.secondary",
            opacity: 0.55,
            whiteSpace: "nowrap",
          }}
        >
          Your contributions
        </Typography>
        <Box
          sx={{
            flex: 1,
            height: "1px",
            bgcolor: "divider",
          }}
        />
      </Box>

      {/* History grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "3px",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {history.map((r) => (
          <Box
            key={`${r.driveId}-${r.uploadedAt}`}
            sx={{
              aspectRatio: "1",
              position: "relative",
              overflow: "hidden",
              bgcolor: "rgba(255,255,255,0.04)",
            }}
          >
            <img
              src={`/api/thumbnail/${r.driveId}`}
              alt={r.name}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Gradient for button contrast */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)",
                pointerEvents: "none",
              }}
            />
            <IconButton
              size="small"
              onClick={() => onDelete(r.driveId)}
              disabled={deletingIds.has(r.driveId)}
              aria-label={`Delete ${r.name}`}
              sx={{
                position: "absolute",
                bottom: 5,
                right: 5,
                width: 28,
                height: 28,
                bgcolor: "rgba(0,0,0,0.48)",
                backdropFilter: "blur(6px)",
                color: "rgba(255,255,255,0.75)",
                borderRadius: "50%",
                "&:hover": { bgcolor: "rgba(0,0,0,0.68)" },
                "&.Mui-disabled": {
                  bgcolor: "rgba(0,0,0,0.3)",
                  color: "rgba(255,255,255,0.3)",
                },
              }}
            >
              {deletingIds.has(r.driveId) ? (
                <CircularProgress size={12} color="inherit" />
              ) : (
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              )}
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function UploadPage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<Status>("validating");
  const [eventInfo, setEventInfo] = useState<
    ValidateTokenResponse["event"] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<{
    qrCodeDataUrl: string;
    uploadUrl: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create object URLs for thumbnails and revoke them when the file list changes
  const previewUrls = useMemo(
    () => selectedFiles.map((f) => URL.createObjectURL(f)),
    [selectedFiles],
  );

  const totalBytes = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.size, 0),
    [selectedFiles],
  );
  const sizePct = Math.min((totalBytes / MAX_UPLOAD_BYTES) * 100, 100);
  const sizeOverLimit = totalBytes > MAX_UPLOAD_BYTES;
  useEffect(() => {
    return () => {
      for (const url of previewUrls) URL.revokeObjectURL(url);
    };
  }, [previewUrls]);

  useEffect(() => {
    if (!slug) {
      setError("No upload link provided.");
      setStatus("invalid");
      return;
    }
    api.events
      .validate(slug)
      .then((res) => {
        if (res.valid) {
          setEventInfo(res.event ?? null);
          setUploadHistory(loadHistory(slug));
          setStatus("ready");
        } else {
          setError(res.error ?? "Invalid link.");
          setStatus("invalid");
        }
      })
      .catch((err: Error) => {
        setError(err.message);
        setStatus("invalid");
      });
  }, [slug]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !existingNames.has(f.name))];
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleDelete = useCallback(
    async (driveId: string) => {
      if (!slug) return;
      setDeletingIds((prev) => new Set(prev).add(driveId));
      try {
        await api.upload.deleteFile(slug, driveId);
        setUploadHistory((prev) => {
          const updated = prev.filter((r) => r.driveId !== driveId);
          saveHistory(slug, updated);
          return updated;
        });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(driveId);
          return next;
        });
      }
    },
    [slug],
  );

  const handleOpenQr = useCallback(async () => {
    if (!slug) return;
    setQrOpen(true);
    if (qrData) return; // already fetched
    setQrLoading(true);
    try {
      const data = await api.events.qr(slug);
      setQrData(data);
    } catch {
      // silently ignore — dialog will show nothing
    } finally {
      setQrLoading(false);
    }
  }, [slug, qrData]);

  const handleUpload = useCallback(async () => {
    if (!slug || selectedFiles.length === 0) return;
    setStatus("uploading");
    setError(null);
    try {
      const result = await api.upload.files(slug, selectedFiles);
      const newRecords: UploadRecord[] = result.files.map((f) => ({
        name: f.name,
        driveId: f.driveId,
        uploadedAt: new Date().toISOString(),
      }));
      setUploadHistory((prev) => {
        const merged = [...newRecords, ...prev];
        saveHistory(slug, merged);
        return merged;
      });
      setSelectedFiles([]);
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("ready");
    }
  }, [slug, selectedFiles]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Validating ─────────────────────────────────── */}
      {status === "validating" && (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
          }}
        >
          <Typography
            sx={{
              letterSpacing: "0.35em",
              color: "primary.main",
              fontSize: "0.68rem",
              textTransform: "uppercase",
            }}
          >
            Memento
          </Typography>
          <CircularProgress size={24} thickness={2} />
        </Box>
      )}

      {/* ── Invalid ────────────────────────────────────── */}
      {status === "invalid" && (
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            px: 5,
            gap: 2,
          }}
        >
          <Typography
            sx={{
              letterSpacing: "0.35em",
              color: "primary.main",
              fontSize: "0.68rem",
              textTransform: "uppercase",
              mb: 1,
            }}
          >
            Memento
          </Typography>
          <Typography variant="h5">Link Unavailable</Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 280 }}
          >
            {error ?? "This link is invalid or has expired."}
          </Typography>
        </Box>
      )}

      {/* ── Ready / Uploading ──────────────────────────── */}
      {(status === "ready" || status === "uploading") && (
        <>
          {/* Header */}
          <Box
            sx={{
              px: 3,
              pt: 5,
              pb: 3,
              textAlign: "center",
              position: "relative",
            }}
          >
            {/* QR share button */}
            <Tooltip title="Share QR code">
              <IconButton
                size="small"
                onClick={handleOpenQr}
                sx={{
                  position: "absolute",
                  top: 16,
                  right: 8,
                  color: "text.secondary",
                  "&:hover": { color: "primary.main" },
                }}
              >
                <QrCode2Icon sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
            <Typography
              sx={{
                letterSpacing: "0.35em",
                color: "primary.main",
                fontSize: "0.65rem",
                textTransform: "uppercase",
                display: "block",
                mb: 2.5,
              }}
            >
              Memento
            </Typography>
            {eventInfo && (
              <>
                <Typography variant="h4" sx={{ lineHeight: 1.25, mb: 0.75 }}>
                  {eventInfo.name}
                </Typography>
                {eventInfo.expiresAt && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ letterSpacing: "0.04em" }}
                  >
                    Link expires{" "}
                    {new Date(eventInfo.expiresAt).toLocaleDateString(
                      undefined,
                      { month: "long", day: "numeric" },
                    )}
                  </Typography>
                )}
              </>
            )}
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, px: 2, pb: 2 }}>
            {/* Drop zone — hidden once files are selected */}
            {selectedFiles.length === 0 && (
              <Box
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) =>
                  e.key === "Enter" && fileInputRef.current?.click()
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                sx={{
                  border: "1px dashed",
                  borderColor: isDragging
                    ? "primary.main"
                    : "rgba(200, 169, 110, 0.22)",
                  borderRadius: 3,
                  py: 8,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2.5,
                  cursor: "pointer",
                  transition:
                    "border-color 0.25s, background-color 0.25s, box-shadow 0.25s",
                  bgcolor: isDragging
                    ? "rgba(200, 169, 110, 0.05)"
                    : "transparent",
                  boxShadow: isDragging
                    ? "0 0 40px rgba(200, 169, 110, 0.07)"
                    : "none",
                  outline: "none",
                  "&:focus-visible": {
                    borderColor: "primary.main",
                    boxShadow: "0 0 0 2px rgba(200, 169, 110, 0.3)",
                  },
                }}
              >
                <PhotoCameraOutlinedIcon
                  sx={{
                    fontSize: 44,
                    color: "primary.main",
                    opacity: isDragging ? 1 : 0.65,
                    transition: "opacity 0.25s",
                  }}
                />
                <Box sx={{ textAlign: "center" }}>
                  <Typography
                    variant="body1"
                    sx={{ color: "text.primary", fontWeight: 400, mb: 0.5 }}
                  >
                    Share your memories
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tap to add photos &amp; videos
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Selected files grid */}
            {selectedFiles.length > 0 && (
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                    px: 0.25,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "0.68rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "text.secondary",
                    }}
                  >
                    {selectedFiles.length}{" "}
                    {selectedFiles.length === 1 ? "memory" : "memories"} ready
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                      fontSize: "0.72rem",
                      letterSpacing: "0.06em",
                      px: 1.5,
                      py: 0.4,
                      minHeight: "auto",
                    }}
                  >
                    Add more
                  </Button>
                </Box>

                {/* Size progress bar */}
                <Box sx={{ px: 0.25, mb: 1.5 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: "0.62rem",
                        color: sizeOverLimit ? "error.main" : "text.secondary",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {sizeOverLimit
                        ? `Exceeds 2 GB limit by ${formatBytes(totalBytes - MAX_UPLOAD_BYTES)}`
                        : formatBytes(totalBytes)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.62rem",
                        color: "text.secondary",
                        opacity: 0.5,
                        letterSpacing: "0.04em",
                      }}
                    >
                      2 GB max
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: "2px",
                      borderRadius: 1,
                      bgcolor: "rgba(255,255,255,0.07)",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        height: "100%",
                        width: `${sizePct}%`,
                        bgcolor: sizeOverLimit
                          ? "error.main"
                          : sizePct > 80
                            ? "warning.main"
                            : "primary.main",
                        transition: "width 0.3s ease, background-color 0.3s",
                      }}
                    />
                  </Box>
                </Box>

                {/* 3-column photo grid */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "3px",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  {selectedFiles.map((f, i) => (
                    <Box
                      key={f.name}
                      sx={{
                        aspectRatio: "1",
                        position: "relative",
                        overflow: "hidden",
                        bgcolor: "rgba(255,255,255,0.04)",
                      }}
                    >
                      {f.type.startsWith("video/") ? (
                        <video
                          src={previewUrls[i]}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                          preload="metadata"
                        >
                          <track kind="captions" />
                        </video>
                      ) : (
                        <img
                          src={previewUrls[i]}
                          alt={f.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      )}
                      {/* Top gradient for icon visibility */}
                      <Box
                        sx={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 45%)",
                          pointerEvents: "none",
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() =>
                          setSelectedFiles((prev) =>
                            prev.filter((x) => x.name !== f.name),
                          )
                        }
                        sx={{
                          position: "absolute",
                          top: 5,
                          right: 5,
                          width: 26,
                          height: 26,
                          bgcolor: "rgba(0,0,0,0.50)",
                          backdropFilter: "blur(6px)",
                          color: "rgba(255,255,255,0.85)",
                          borderRadius: "50%",
                          "&:hover": { bgcolor: "rgba(0,0,0,0.70)" },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Errors & progress */}
            {error && (
              <Alert severity="error" sx={{ mt: 2.5 }}>
                {error}
              </Alert>
            )}
            {status === "uploading" && (
              <LinearProgress sx={{ mt: 2.5, mx: 0.25 }} />
            )}

            {/* Upload CTA */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              disabled={
                selectedFiles.length === 0 ||
                status === "uploading" ||
                sizeOverLimit
              }
              onClick={handleUpload}
              sx={{ mt: 3 }}
              startIcon={
                status === "uploading" ? (
                  <CircularProgress size={17} color="inherit" />
                ) : undefined
              }
            >
              {status === "uploading"
                ? "Sharing…"
                : selectedFiles.length === 0
                  ? "Select Photos & Videos"
                  : `Share ${selectedFiles.length} ${selectedFiles.length === 1 ? "Memory" : "Memories"}`}
            </Button>
          </Box>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />

          {/* Upload history */}
          <UploadHistory
            history={uploadHistory}
            deletingIds={deletingIds}
            onDelete={handleDelete}
          />
        </>
      )}

      {/* ── Done ───────────────────────────────────────── */}
      {status === "done" && (
        <>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              px: 5,
              gap: 2,
              py: 8,
            }}
          >
            {/* Gold check circle */}
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: "1.5px solid",
                borderColor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1,
              }}
            >
              <CheckIcon sx={{ fontSize: 34, color: "primary.main" }} />
            </Box>

            <Typography variant="h5">Beautifully shared</Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 260, lineHeight: 1.7 }}
            >
              Your memories are now part of the celebration.
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setError(null);
                  setStatus("ready");
                }}
              >
                Share More
              </Button>
              <Button
                variant="outlined"
                startIcon={<QrCode2Icon />}
                onClick={handleOpenQr}
              >
                QR Code
              </Button>
            </Stack>
          </Box>

          <UploadHistory
            history={uploadHistory}
            deletingIds={deletingIds}
            onDelete={handleDelete}
          />
        </>
      )}

      {/* ── QR code dialog ─────────────────────────────── */}
      <Dialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            backgroundImage: "none",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            mx: 2,
          },
        }}
      >
        <DialogContent sx={{ textAlign: "center", py: 4 }}>
          {qrLoading && (
            <Box sx={{ py: 6 }}>
              <CircularProgress size={24} thickness={2} />
            </Box>
          )}
          {!qrLoading && qrData && (
            <Stack spacing={2.5} alignItems="center">
              <Typography variant="h5">{eventInfo?.name ?? "Share"}</Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "#fff",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "rgba(200, 169, 110, 0.2)",
                }}
              >
                <Box
                  component="img"
                  src={qrData.qrCodeDataUrl}
                  alt="QR code"
                  sx={{ width: "100%", maxWidth: 220, display: "block" }}
                />
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.72rem",
                  wordBreak: "break-all",
                }}
              >
                {qrData.uploadUrl}
              </Typography>
              <Divider flexItem />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (!qrData) return;
                    const a = document.createElement("a");
                    a.href = qrData.qrCodeDataUrl;
                    a.download = `${eventInfo?.name ?? "event"}-qr.png`;
                    a.click();
                  }}
                >
                  Download
                </Button>
                <Button variant="contained" onClick={() => setQrOpen(false)}>
                  Done
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
