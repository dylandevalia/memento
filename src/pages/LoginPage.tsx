import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
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
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  const isSetup = !hasPassword;

  return (
    <Container maxWidth="xs">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <Box
          sx={{
            bgcolor: "primary.main",
            borderRadius: "50%",
            p: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LockOutlinedIcon sx={{ color: "white", fontSize: 28 }} />
        </Box>

        <Typography variant="h5" fontWeight={600}>
          {isSetup ? "Set Admin Password" : "Admin Login"}
        </Typography>

        {isSetup && (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No password has been set yet. Create one to protect the admin
            portal.
          </Typography>
        )}

        <Box
          component="form"
          onSubmit={handleSubmit}
          width="100%"
          display="flex"
          flexDirection="column"
          gap={2}
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
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : isSetup ? (
              "Set Password"
            ) : (
              "Login"
            )}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
