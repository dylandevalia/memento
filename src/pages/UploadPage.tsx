import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { ValidateTokenResponse } from "../types";

type Status = "validating" | "invalid" | "ready" | "uploading" | "done";

interface UploadRecord {
  name: string;
  driveId: string;
  uploadedAt: string; // ISO 8601
}

function storageKey(slug: string) {
  return `photo-uploader:uploads:${slug}`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create object URLs for thumbnails and revoke them when the file list changes
  const previewUrls = useMemo(
    () => selectedFiles.map((f) => URL.createObjectURL(f)),
    [selectedFiles],
  );
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
    <Container maxWidth="sm" sx={{ py: 6 }}>
      {status === "validating" && (
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress />
          <Typography>Validating link…</Typography>
        </Box>
      )}

      {status === "invalid" && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error ?? "This link is invalid or has expired."}
        </Alert>
      )}

      {(status === "ready" || status === "uploading") && (
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              Upload Photos
            </Typography>
            {eventInfo && (
              <Typography color="text.secondary">
                {eventInfo.name}
                {eventInfo.expiresAt
                  ? ` · Expires ${new Date(eventInfo.expiresAt).toLocaleString()}`
                  : ""}
              </Typography>
            )}
          </Box>

          {/* Drop zone */}
          <Card
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            sx={{
              border: "2px dashed",
              borderColor: isDragging ? "primary.main" : "divider",
              backgroundColor: isDragging ? "action.hover" : "background.paper",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <CardContent>
              <Stack alignItems="center" spacing={1} py={3}>
                <CloudUploadIcon sx={{ fontSize: 48 }} color="action" />
                <Typography variant="body1">
                  Drag & drop files here, or click to select
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Photos and videos only
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />

          {selectedFiles.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {selectedFiles.length} file
                {selectedFiles.length !== 1 ? "s" : ""} selected
              </Typography>
              <ImageList cols={3} rowHeight={140} gap={6}>
                {selectedFiles.map((f, i) => (
                  <ImageListItem
                    key={f.name}
                    sx={{ borderRadius: 1, overflow: "hidden" }}
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
                    <ImageListItemBar
                      title={f.name}
                      subtitle={`${(f.size / 1024 / 1024).toFixed(2)} MB`}
                      actionIcon={
                        <IconButton
                          size="small"
                          sx={{ color: "white" }}
                          onClick={() =>
                            setSelectedFiles((prev) =>
                              prev.filter((x) => x.name !== f.name),
                            )
                          }
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      }
                    />
                  </ImageListItem>
                ))}
              </ImageList>
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {status === "uploading" && <LinearProgress />}

          <Button
            variant="contained"
            size="large"
            disabled={selectedFiles.length === 0 || status === "uploading"}
            onClick={handleUpload}
            startIcon={
              status === "uploading" ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
          >
            {status === "uploading"
              ? "Uploading…"
              : `Upload ${selectedFiles.length || ""} File${selectedFiles.length !== 1 ? "s" : ""}`}
          </Button>
        </Stack>
      )}

      {status === "done" && (
        <Stack spacing={3}>
          <Alert severity="success">
            {uploadHistory[0]
              ? `Uploaded successfully on ${new Date(uploadHistory[0].uploadedAt).toLocaleString()}`
              : "Uploaded successfully!"}
          </Alert>
          <Button variant="outlined" onClick={() => setStatus("ready")}>
            Upload More
          </Button>
        </Stack>
      )}

      {/* Persistent upload history */}
      {(status === "ready" || status === "uploading" || status === "done") &&
        uploadHistory.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Previously uploaded
            </Typography>
            <ImageList cols={3} rowHeight={140} gap={6}>
              {uploadHistory.map((r) => (
                <ImageListItem
                  key={`${r.driveId}-${r.uploadedAt}`}
                  sx={{
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "action.hover",
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
                      // Hide broken image icon if Drive has no thumbnail yet
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  <ImageListItemBar
                    subtitle={new Date(r.uploadedAt).toLocaleString()}
                  />
                </ImageListItem>
              ))}
            </ImageList>
          </Box>
        )}
    </Container>
  );
}
