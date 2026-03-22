import DeleteIcon from "@mui/icons-material/Delete";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GoogleIcon from "@mui/icons-material/Google";
import LockIcon from "@mui/icons-material/Lock";
import LogoutIcon from "@mui/icons-material/Logout";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
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

  // Determine which stepper step the admin is on
  const activeStep = !credsConfigured
    ? 0
    : !googleCreds.connected || !folderConnected
      ? 1
      : 2;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Event Admin
      </Typography>
      {/* ── Setup stepper ────────────────────────────────────────────── */}
      {(!readyForEvents || editingCreds) && (
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardHeader
            title="Setup"
            subheader="Complete these steps once to connect your Google Account"
          />
          <CardContent>
            <Stepper
              activeStep={editingCreds ? 0 : activeStep}
              orientation="vertical"
            >
              {/* Step 1 — Google credentials */}
              <Step>
                <StepLabel
                  optional={
                    credsConfigured && !editingCreds ? (
                      <Button
                        size="small"
                        onClick={() => {
                          setSetupClientSecret("");
                          setEditingCreds(true);
                        }}
                      >
                        Edit credentials
                      </Button>
                    ) : undefined
                  }
                >
                  Add Google API credentials
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Create an OAuth 2.0 Web Client and an API Key in the{" "}
                    <a
                      href="https://console.cloud.google.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Cloud Console
                    </a>
                    . Enable the <strong>Google Drive API</strong> and{" "}
                    <strong>Google Picker API</strong> for your project. Add
                    this app’s URL as an Authorised JavaScript Origin on the
                    OAuth client.
                  </Typography>
                  <Stack spacing={2}>
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
                        editingCreds
                          ? "Re-enter your Client Secret"
                          : "GOCSPX-…"
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
                        savingCreds ? <CircularProgress size={18} /> : undefined
                      }
                      sx={{ alignSelf: "flex-start" }}
                    >
                      {savingCreds ? "Saving…" : "Save Credentials"}
                    </Button>
                  </Stack>
                </StepContent>
              </Step>

              {/* Step 2 — Connect Google & pick folder */}
              <Step>
                <StepLabel>
                  Sign in with Google & choose a Drive folder
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Sign in with your Google account to authorise this app and
                    choose the Drive folder where uploaded photos will be
                    stored.
                  </Typography>
                  {(pickerError || folderError) && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {pickerError ?? folderError}
                    </Alert>
                  )}
                  {folderConnected && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Folder selected:{" "}
                      <strong>{driveConfig.rootFolderName}</strong>
                    </Alert>
                  )}
                  <Button
                    variant="contained"
                    startIcon={
                      pickerLoading || savingFolder ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <GoogleIcon />
                      )
                    }
                    disabled={pickerLoading || savingFolder}
                    onClick={pickFolder}
                  >
                    {pickerLoading
                      ? "Waiting for Google…"
                      : savingFolder
                        ? "Saving…"
                        : folderConnected
                          ? "Change Folder"
                          : "Sign in with Google & Choose Folder"}
                  </Button>
                </StepContent>
              </Step>

              <Step>
                <StepLabel>Ready</StepLabel>
                <StepContent />
              </Step>
            </Stepper>
          </CardContent>
        </Card>
      )}
      {/* ── Drive folder summary (once set up) ───────────────────────── */}
      {readyForEvents && (
        <Card variant="outlined" sx={{ mb: 4, borderColor: "success.main" }}>
          <CardContent>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <FolderIcon color="success" />
                <Typography fontWeight={500}>
                  {driveConfig.rootFolderName}
                </Typography>
                <Chip
                  label={driveConfig.rootFolderId}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: "monospace" }}
                />
              </Stack>
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  pickerLoading || savingFolder ? (
                    <CircularProgress size={14} />
                  ) : (
                    <FolderIcon />
                  )
                }
                disabled={pickerLoading || savingFolder}
                onClick={pickFolder}
              >
                Change
              </Button>
            </Stack>
            {(pickerError || folderError) && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {pickerError ?? folderError}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      {/* ── Create event ───────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardHeader title="Create New Event" />
        <CardContent>
          <Stack spacing={2}>
            {!readyForEvents && !loading && (
              <Alert severity="warning">
                Complete the setup steps above before creating events.
              </Alert>
            )}
            <TextField
              label="Event Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!readyForEvents}
              fullWidth
            />
            <TextField
              label="Expires At (optional)"
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
                creating ? <CircularProgress size={18} /> : <QrCode2Icon />
              }
            >
              {creating ? "Creating…" : "Create & Generate QR Code"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      {/* Event list */}
      <Typography variant="h5" fontWeight={600} gutterBottom>
        Events
      </Typography>
      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && events.length === 0 && (
        <Typography color="text.secondary">No events yet.</Typography>
      )}
      <Stack spacing={2}>
        {events.map((event) => {
          const expired =
            event.expiresAt !== null && new Date(event.expiresAt) < new Date();
          return (
            <Card key={event.id} variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box>
                    <Typography variant="h6">{event.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {event.expiresAt ? (
                        <>
                          Expires: {new Date(event.expiresAt).toLocaleString()}
                          {expired && (
                            <Box component="span" color="error.main" ml={1}>
                              (expired)
                            </Box>
                          )}
                        </>
                      ) : (
                        "No expiration"
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      URL: <code>/upload/{event.slug}</code>
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Open upload page">
                      <IconButton
                        component="a"
                        href={`/upload/${event.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        disabled={expired}
                      >
                        <OpenInNewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Open Drive folder">
                      <IconButton
                        component="a"
                        href={`https://drive.google.com/drive/folders/${event.driveFolderId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FolderOpenIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete event">
                      <IconButton
                        color="error"
                        onClick={() => handleDelete(event.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
      {/* ── Security ─────────────────────────────────────────────────── */}
      <Card variant="outlined" sx={{ mt: 4, mb: 4 }}>
        <CardHeader
          title="Security"
          avatar={<LockIcon color="action" />}
          action={
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout}>
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          }
        />
        <CardContent>
          <Stack spacing={2} maxWidth={400}>
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
              <Alert severity="success">Password changed successfully.</Alert>
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
                  <CircularProgress size={18} color="inherit" />
                ) : undefined
              }
              sx={{ alignSelf: "flex-start" }}
            >
              {changingPassword ? "Saving…" : "Change Password"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
      {/* QR code dialog */}
      <Dialog
        open={!!qrDialog}
        onClose={() => setQrDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>QR Code Generated</DialogTitle>
        <DialogContent>
          {qrDialog && (
            <Stack spacing={2} alignItems="center" py={2}>
              <Typography variant="body1" fontWeight={600}>
                {qrDialog.event.name}
              </Typography>
              <Box
                component="img"
                src={qrDialog.qrCodeDataUrl}
                alt="QR code"
                sx={{ width: "100%", maxWidth: 300 }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                {qrDialog.uploadUrl}
              </Typography>
              <Divider flexItem />
              <Stack direction="row" spacing={1}>
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
    </Container>
  );
}
