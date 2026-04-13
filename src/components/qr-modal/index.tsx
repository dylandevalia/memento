import SendRoundedIcon from "@mui/icons-material/SendRounded";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { handleError } from "@/lib/errorHandler";

interface QrModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  eventName?: string;
}

interface QrData {
  qrCodeDataUrl: string;
  uploadUrl: string;
}

export function QrModal({ open, onClose, slug, eventName }: QrModalProps) {
  const [loading, setLoading] = useState(false);
  const [qrData, setQrData] = useState<QrData | null>(null);

  useEffect(() => {
    if (!open || qrData) return;

    async function fetchQr() {
      setLoading(true);
      try {
        const data = await api.events.qr(slug);
        setQrData(data);
      } catch (error) {
        handleError(error, "QrModal:fetchQr");
      } finally {
        setLoading(false);
      }
    }

    fetchQr();
  }, [open, slug, qrData]);

  const handleShare = useCallback(() => {
    if (!qrData || !navigator.share) return;

    const shareText = eventName
      ? `📸 Share your photos and videos from ${eventName}! Tap the link below to upload:`
      : "📸 Share your photos and videos with us! Tap the link below to upload:";

    navigator
      .share({
        title: eventName
          ? `${eventName} - Upload Photos`
          : "Upload Your Photos",
        text: shareText,
        url: qrData.uploadUrl,
      })
      .catch((error) => {
        handleError(error, "QrModal:share");
      });
  }, [qrData, eventName]);

  const handleCopyLink = useCallback(async () => {
    if (!qrData) return;

    try {
      await navigator.clipboard.writeText(qrData.uploadUrl);
      // Could add a toast notification here
    } catch (error) {
      handleError(error, "QrModal:copyLink");
    }
  }, [qrData]);

  // Check if Web Share API is available
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent sx={{ textAlign: "center", py: 4 }}>
        {loading && (
          <Stack spacing={2} alignItems="center" sx={{ py: 6 }}>
            <CircularProgress size={24} thickness={2} />
            <Typography variant="body2" color="text.secondary">
              Generating QR code...
            </Typography>
          </Stack>
        )}

        {!loading && !qrData && (
          <Typography variant="body2" color="error">
            Failed to load QR code
          </Typography>
        )}

        {!loading && qrData && (
          <Stack spacing={2.5} alignItems="center">
            <Typography variant="h5">{eventName || "Share"}</Typography>

            <Stack
              sx={{
                p: 1.5,
                bgcolor: "#fff",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "rgba(168, 85, 247, 0.2)",
              }}
            >
              <img
                src={qrData.qrCodeDataUrl}
                alt="QR code"
                style={{
                  width: "100%",
                  maxWidth: "220px",
                  display: "block",
                }}
              />
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontFamily: "monospace",
                fontSize: "0.72rem",
                wordBreak: "break-all",
                px: 2,
              }}
            >
              {qrData.uploadUrl}
            </Typography>

            <Divider flexItem />

            <Stack direction="row" spacing={1}>
              {canShare && (
                <Button
                  variant="outlined"
                  startIcon={<SendRoundedIcon />}
                  onClick={handleShare}
                >
                  share
                </Button>
              )}
              <Button variant="outlined" onClick={handleCopyLink}>
                copy link
              </Button>
            </Stack>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
