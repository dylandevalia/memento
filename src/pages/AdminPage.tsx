import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GoogleIcon from "@mui/icons-material/Google";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGooglePicker } from "../hooks/useGooglePicker";
import { api } from "../lib/api";
import { ADMIN_AUTH_KEY } from "../lib/auth";
import type {
  CreateEventResponse,
  DriveConfig,
  Event,
  GoogleCredentials,
} from "../types";

// ── Shared layout primitives ───────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ mb: 5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: subtitle ? 0.5 : 2.5,
        }}
      >
        {icon}
        <Typography variant="h5" sx={{ fontSize: "1.1rem" }}>
          {title}
        </Typography>
      </Box>
      {subtitle && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2.5, lineHeight: 1.7 }}
        >
          {subtitle}
        </Typography>
      )}
      <Box
        sx={{
          border: "1px solid",
          borderColor: "rgba(168, 85, 247, 0.15)",
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "background.paper",
          boxShadow: "0 2px 16px rgba(168, 85, 247, 0.07)",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function SetupStep({
  number,
  title,
  done,
  doneAction,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  doneAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ px: 2.5, py: 2.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
        }}
      >
        {/* Step number / check */}
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "1.5px solid",
            borderColor: done ? "success.main" : "rgba(168, 85, 247, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            mt: 0.1,
            color: done ? "success.main" : "text.secondary",
            transition: "all 0.2s",
          }}
        >
          {done ? (
            <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
          ) : (
            <Typography sx={{ fontSize: "0.7rem", lineHeight: 1 }}>
              {number}
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: done ? 0 : 1.5,
            }}
          >
            <Typography
              sx={{
                fontSize: "0.88rem",
                fontWeight: 500,
                color: done ? "text.secondary" : "text.primary",
              }}
            >
              {title}
            </Typography>
            {doneAction}
          </Box>
          {!done && children}
        </Box>
      </Box>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Google credentials (stored in DB, fetched from API)
  const [googleCreds, setGoogleCreds] = useState<GoogleCredentials>({
    clientId: null,
    apiKey: null,
    connected: false,
  });
  const [setupClientId, setSetupClientId] = useState("");
  const [setupClientSecret, setSetupClientSecret] = useState("");
  const [setupApiKey, setSetupApiKey] = useState("");
  const [savingCreds, setSavingCreds] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [editingCreds, setEditingCreds] = useState(false);

  const [driveConfig, setDriveConfig] = useState<DriveConfig>({
    rootFolderId: null,
    rootFolderName: null,
  });
  const [savingFolder, setSavingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);

  // Create-event form state
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // QR dialog
  const [qrDialog, setQrDialog] = useState<CreateEventResponse | null>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(
    null,
  );
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

  const {
    pickFolder,
    loading: pickerLoading,
    error: pickerError,
  } = useGooglePicker({
    onPicked: async ({ id, name: folderName }) => {
      setSavingFolder(true);
      setFolderError(null);
      try {
        const updated = await api.config.setFolder(id, folderName);
        setDriveConfig(updated);
        // Mark as connected since we just completed the OAuth flow
        setGoogleCreds((prev) => ({ ...prev, connected: true }));
      } catch (err) {
        setFolderError((err as Error).message);
      } finally {
        setSavingFolder(false);
      }
    },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [evts, cfg, gcreds] = await Promise.all([
        api.events.list(),
        api.config.get(),
        api.config.getGoogle(),
      ]);
      setEvents(evts);
      setDriveConfig(cfg);
      setGoogleCreds(gcreds);
      if (gcreds.clientId) setSetupClientId(gcreds.clientId);
      if (gcreds.apiKey) setSetupApiKey(gcreds.apiKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSaveCredentials() {
    if (
      !setupClientId.trim() ||
      !setupClientSecret.trim() ||
      !setupApiKey.trim()
    )
      return;
    setSavingCreds(true);
    setCredsError(null);
    try {
      const updated = await api.config.saveGoogle(
        setupClientId.trim(),
        setupClientSecret.trim(),
        setupApiKey.trim(),
      );
      setGoogleCreds(updated);
      setSetupClientSecret(""); // clear secret from the form after saving
      setEditingCreds(false);
    } catch (err) {
      setCredsError((err as Error).message);
    } finally {
      setSavingCreds(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await api.events.create({
        name: name.trim(),
        expiresAt: expiresAt || null,
      });
      setQrDialog(result);
      setName("");
      setExpiresAt("");
      await loadData();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this event? The Drive folder will not be removed."))
      return;
    try {
      await api.events.delete(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    navigate("/login", { replace: true });
  }

  async function handleChangePassword() {
    setChangePasswordError(null);
    setChangePasswordSuccess(false);
    if (!newPassword) {
      setChangePasswordError("New password cannot be empty");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setChangePasswordSuccess(true);
    } catch (err) {
      setChangePasswordError((err as Error).message);
    } finally {
      setChangingPassword(false);
    }
  }

  // Minimum datetime-local value = now
  const minDate = new Date(Date.now() + 60_000).toISOString().slice(0, 16);
  const credsConfigured = Boolean(googleCreds.clientId && googleCreds.apiKey);
  const folderConnected = Boolean(driveConfig.rootFolderId);
  const readyForEvents =
    credsConfigured && googleCreds.connected && folderConnected;

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.paper",
          borderBottom: "2px solid",
          borderColor: "rgba(168, 85, 247, 0.18)",
          px: { xs: 2.5, sm: 4 },
          py: 1.75,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 16px rgba(168, 85, 247, 0.08)",
        }}
      >
        <Box>
          <Typography
            className="rainbow-text"
            sx={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.3rem",
              letterSpacing: "0.04em",
              lineHeight: 1,
              mb: 0.2,
            }}
          >
            Memento
          </Typography>
          <Typography
            sx={{
              fontSize: "0.72rem",
              color: "text.secondary",
              letterSpacing: "0.06em",
            }}
          >
            Admin Portal
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton
            onClick={handleLogout}
            size="small"
            sx={{
              color: "text.secondary",
              "&:hover": { color: "text.primary" },
            }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <Box
        sx={{
          maxWidth: 680,
          mx: "auto",
          px: { xs: 2.5, sm: 4 },
          py: { xs: 4, sm: 5 },
        }}
      >
        {/* Global loading */}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress size={24} thickness={2} />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {/* ── Setup ─────────────────────────────────────────────────── */}
        {(!readyForEvents || editingCreds) && !loading && (
          <Section
            title="Setup"
            subtitle="Connect your Google account once to get started"
          >
            <Stack spacing={0} divider={<Divider />}>
              {/* Step 1 — Credentials */}
              <SetupStep
                number={1}
                title="Add Google API credentials"
                done={credsConfigured && !editingCreds}
                doneAction={
                  credsConfigured && !editingCreds ? (
                    <Button
                      size="small"
                      onClick={() => {
                        setSetupClientSecret("");
                        setEditingCreds(true);
                      }}
                    >
                      Edit
                    </Button>
                  ) : undefined
                }
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2, lineHeight: 1.75 }}
                >
                  Create an OAuth 2.0 Web Client and an API Key in the{" "}
                  <Box
                    component="a"
                    href="https://console.cloud.google.com"
                    target="_blank"
                    rel="noreferrer"
                    sx={{
                      color: "primary.main",
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    Google Cloud Console
                  </Box>
                  . Enable the <strong>Drive API</strong> and{" "}
                  <strong>Picker API</strong>, then add this app's URL as an
                  Authorised JavaScript Origin.
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label="Client ID"
                    value={setupClientId}
                    onChange={(e) => setSetupClientId(e.target.value)}
                    placeholder="xxxxxxxx.apps.googleusercontent.com"
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Client Secret"
                    type={showSecret ? "text" : "password"}
                    value={setupClientSecret}
                    onChange={(e) => setSetupClientSecret(e.target.value)}
                    placeholder={
                      editingCreds ? "Re-enter your Client Secret" : "GOCSPX-…"
                    }
                    helperText={
                      editingCreds
                        ? "Always required when updating credentials"
                        : undefined
                    }
                    fullWidth
                    size="small"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button
                              size="small"
                              onClick={() => setShowSecret((s) => !s)}
                              sx={{ fontSize: "0.7rem", minWidth: "auto" }}
                            >
                              {showSecret ? "Hide" : "Show"}
                            </Button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    label="API Key"
                    value={setupApiKey}
                    onChange={(e) => setSetupApiKey(e.target.value)}
                    placeholder="AIzaSy…"
                    fullWidth
                    size="small"
                  />
                  {credsError && <Alert severity="error">{credsError}</Alert>}
                  <Button
                    variant="contained"
                    onClick={handleSaveCredentials}
                    disabled={
                      savingCreds ||
                      !setupClientId.trim() ||
                      !setupClientSecret.trim() ||
                      !setupApiKey.trim()
                    }
                    startIcon={
                      savingCreds ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : undefined
                    }
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {savingCreds ? "Saving…" : "Save Credentials"}
                  </Button>
                </Stack>
              </SetupStep>

              {/* Step 2 — Sign in & pick folder */}
              <SetupStep
                number={2}
                title="Sign in with Google & choose a Drive folder"
                done={folderConnected && googleCreds.connected}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2, lineHeight: 1.75 }}
                >
                  Authorise this app and choose the Drive folder where uploaded
                  photos will be stored.
                </Typography>
                {(pickerError || folderError) && (
                  <Alert severity="error" sx={{ mb: 1.5 }}>
                    {pickerError ?? folderError}
                  </Alert>
                )}
                {folderConnected && (
                  <Alert severity="success" sx={{ mb: 1.5 }}>
                    Folder: <strong>{driveConfig.rootFolderName}</strong>
                  </Alert>
                )}
                <Button
                  variant="contained"
                  startIcon={
                    pickerLoading || savingFolder ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <GoogleIcon />
                    )
                  }
                  disabled={pickerLoading || savingFolder || !credsConfigured}
                  onClick={pickFolder}
                >
                  {pickerLoading
                    ? "Waiting for Google…"
                    : savingFolder
                      ? "Saving…"
                      : folderConnected
                        ? "Change Folder"
                        : "Sign in & Choose Folder"}
                </Button>
              </SetupStep>
            </Stack>
          </Section>
        )}

        {/* ── Drive folder status bar ───────────────────────────────── */}
        {readyForEvents && !editingCreds && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.5,
              mb: 4,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "rgba(120, 169, 154, 0.25)",
              bgcolor: "rgba(120, 169, 154, 0.05)",
            }}
          >
            <FolderIcon
              sx={{ fontSize: 18, color: "success.main", opacity: 0.8 }}
            />
            <Typography
              sx={{ flex: 1, fontSize: "0.82rem", color: "text.secondary" }}
            >
              <Box
                component="span"
                sx={{ color: "text.primary", fontWeight: 500 }}
              >
                {driveConfig.rootFolderName}
              </Box>{" "}
              &nbsp;·&nbsp;{" "}
              <Box
                component="span"
                sx={{ fontFamily: "monospace", fontSize: "0.74rem" }}
              >
                {driveConfig.rootFolderId}
              </Box>
            </Typography>
            <Button
              size="small"
              disabled={pickerLoading || savingFolder}
              onClick={pickFolder}
              sx={{ flexShrink: 0, fontSize: "0.72rem" }}
            >
              Change
            </Button>
          </Box>
        )}

        {/* ── Create event ─────────────────────────────────────────── */}
        <Section title="New Event">
          <Stack spacing={1.5}>
            {!readyForEvents && !loading && (
              <Alert severity="warning" sx={{ mb: 0.5 }}>
                Complete setup above before creating events.
              </Alert>
            )}
            <TextField
              label="Event Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!readyForEvents}
              fullWidth
              placeholder="Summer Wedding 2026"
            />
            <TextField
              label="Link expires at (optional)"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={!readyForEvents}
              fullWidth
              slotProps={{
                htmlInput: { min: minDate },
                inputLabel: { shrink: true },
              }}
              helperText="Leave blank for no expiration"
            />
            {createError && <Alert severity="error">{createError}</Alert>}
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={creating || !name.trim() || !readyForEvents}
              startIcon={
                creating ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <QrCode2Icon />
                )
              }
              sx={{ alignSelf: "flex-start" }}
            >
              {creating ? "Creating…" : "Create & Generate QR Code"}
            </Button>
          </Stack>
        </Section>

        {/* ── Event list ───────────────────────────────────────────── */}
        <Section title="Events">
          {!loading && events.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No events yet. Create one above.
            </Typography>
          )}
          <Stack spacing={2}>
            {events.map((event) => {
              const expired =
                event.expiresAt !== null &&
                new Date(event.expiresAt) < new Date();
              return (
                <Box
                  key={event.id}
                  sx={{
                    border: "1px solid",
                    borderColor: expired
                      ? "rgba(217, 112, 112, 0.15)"
                      : "rgba(168, 85, 247, 0.12)",
                    borderRadius: 3,
                    px: 2.5,
                    py: 2,
                    bgcolor: "background.paper",
                    transition: "box-shadow 0.2s ease, transform 0.2s ease",
                    "&:hover": {
                      boxShadow: "0 4px 20px rgba(168, 85, 247, 0.12)",
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="h6"
                        sx={{ fontSize: "1rem", mb: 0.4, lineHeight: 1.35 }}
                      >
                        {event.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color={expired ? "error.main" : "text.secondary"}
                        sx={{ fontSize: "0.78rem", mb: 0.5 }}
                      >
                        {event.expiresAt
                          ? `${expired ? "Expired" : "Expires"} ${new Date(event.expiresAt).toLocaleString()}`
                          : "No expiration"}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.74rem",
                          fontFamily: "monospace",
                          color: "text.secondary",
                          opacity: 0.7,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        /event/{event.slug}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                      <Tooltip title="Open upload page">
                        <span>
                          <IconButton
                            component="a"
                            href={`/event/${event.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            size="small"
                            disabled={expired}
                            sx={{ color: "text.secondary" }}
                          >
                            <OpenInNewIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Open Drive folder">
                        <IconButton
                          component="a"
                          href={`https://drive.google.com/drive/folders/${event.driveFolderId}`}
                          target="_blank"
                          rel="noreferrer"
                          size="small"
                          sx={{ color: "text.secondary" }}
                        >
                          <FolderOpenIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete event">
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(event.id)}
                          sx={{
                            color: "text.secondary",
                            "&:hover": { color: "error.main" },
                          }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Section>

        {/* ── Security ─────────────────────────────────────────────── */}
        <Section
          title="Security"
          icon={<LockOutlinedIcon sx={{ fontSize: 16, opacity: 0.5 }} />}
        >
          <Stack spacing={1.5} sx={{ maxWidth: 380 }}>
            <Typography variant="body2" color="text.secondary">
              Change the admin portal password.
            </Typography>
            <TextField
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              size="small"
              autoComplete="current-password"
            />
            <TextField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              size="small"
              autoComplete="new-password"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              fullWidth
              size="small"
              autoComplete="new-password"
            />
            {changePasswordError && (
              <Alert severity="error">{changePasswordError}</Alert>
            )}
            {changePasswordSuccess && (
              <Alert severity="success">Password changed.</Alert>
            )}
            <Button
              variant="contained"
              onClick={handleChangePassword}
              disabled={
                changingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmNewPassword
              }
              startIcon={
                changingPassword ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
              sx={{ alignSelf: "flex-start" }}
            >
              {changingPassword ? "Saving…" : "Change Password"}
            </Button>
          </Stack>
        </Section>
      </Box>

      {/* ── QR dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={!!qrDialog}
        onClose={() => setQrDialog(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "background.paper",
            backgroundImage: "none",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", pt: 4, pb: 1 }}>
          <Typography variant="h5">{qrDialog?.event.name}</Typography>
        </DialogTitle>
        <DialogContent>
          {qrDialog && (
            <Stack spacing={2.5} alignItems="center" py={1}>
              {/* QR code with colourful border */}
              <Box
                sx={{
                  p: 1.5,
                  border: "2px solid",
                  borderColor: "rgba(168, 85, 247, 0.3)",
                  borderRadius: 3,
                  bgcolor: "#fff",
                  boxShadow: "0 4px 20px rgba(168, 85, 247, 0.15)",
                }}
              >
                <Box
                  component="img"
                  src={qrDialog.qrCodeDataUrl}
                  alt="QR code"
                  sx={{ width: "100%", maxWidth: 240, display: "block" }}
                />
              </Box>
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
                sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
              >
                {qrDialog.uploadUrl}
              </Typography>
              <Divider flexItem />
              <Stack direction="row" spacing={1} pb={1}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = qrDialog.qrCodeDataUrl;
                    a.download = `${qrDialog.event.name}-qr.png`;
                    a.click();
                  }}
                >
                  Download PNG
                </Button>
                <Button variant="contained" onClick={() => setQrDialog(null)}>
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
