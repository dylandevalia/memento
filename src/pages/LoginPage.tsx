import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ADMIN_AUTH_KEY } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated this session, skip login
  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_AUTH_KEY) === "1") {
      navigate("/admin", { replace: true });
      return;
    }
    api.auth.status().then(({ hasPassword: hp }) => setHasPassword(hp));
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasPassword) {
      // Setting initial password
      if (password.length < 1) {
        setError("Password cannot be empty");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      setLoading(true);
      try {
        await api.auth.setInitialPassword(password);
        sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
        navigate("/admin", { replace: true });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    } else {
      // Normal login
      setLoading(true);
      try {
        await api.auth.login(password);
        sessionStorage.setItem(ADMIN_AUTH_KEY, "1");
        navigate("/admin", { replace: true });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
  }

  if (hasPassword === null) {
    return (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <CircularProgress size={24} thickness={2} />
      </Box>
    );
  }

  const isSetup = !hasPassword;

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 3,
      }}
    >
      {/* Wordmark */}
      <Typography
        className="rainbow-text"
        sx={{
          fontFamily: 'var(--font-heading)',
          fontSize: "2rem",
          letterSpacing: "0.06em",
          mb: 4,
        }}
      >
        Memento
      </Typography>

      {/* Lock icon */}
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, rgba(255,77,158,0.15), rgba(168,85,247,0.15))",
          border: "2px solid",
          borderColor: "rgba(168, 85, 247, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
          animation: "bounce-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        <LockOutlinedIcon
          sx={{ fontSize: 22, color: "primary.main", opacity: 0.8 }}
        />
      </Box>

      <Typography variant="h5" sx={{ mb: 0.75 }}>
        {isSetup ? "Set Admin Password" : "Admin Portal"}
      </Typography>

      {isSetup && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", maxWidth: 280, mb: 1, lineHeight: 1.7 }}
        >
          Create a password to protect the admin portal.
        </Typography>
      )}

      {/* Form */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          mt: 3,
        }}
      >
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          autoFocus
          autoComplete={isSetup ? "new-password" : "current-password"}
        />

        {isSetup && (
          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            autoComplete="new-password"
          />
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={loading}
          sx={{ mt: 0.5 }}
        >
          {loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : isSetup ? (
            "Set Password"
          ) : (
            "Sign In"
          )}
        </Button>
      </Box>
    </Box>
  );
}
