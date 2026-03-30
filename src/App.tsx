import { CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ADMIN_AUTH_KEY } from "./lib/auth";

// In dev: static/eager imports so Vite Fast Refresh / HMR works correctly.
// In prod: lazy() so each route is a separate chunk that's only fetched on demand.
// Vite statically analyses import.meta.env.PROD and tree-shakes the dead branch.
const AdminPage = import.meta.env.PROD
  ? lazy(() => import("./pages/AdminPage"))
  : (await import("./pages/AdminPage")).default;

const LoginPage = import.meta.env.PROD
  ? lazy(() => import("./pages/LoginPage"))
  : (await import("./pages/LoginPage")).default;

const EventPage = import.meta.env.PROD
  ? lazy(() =>
      import("./pages/EventPage").then((m) => ({
        default: m.EventPage,
      })),
    )
  : (await import("./pages/EventPage")).EventPage;

// ── Purple-focused palette using Material 3 variables ─────────────────────
const PRIMARY = "rgb(var(--mui-purple-500))"; // #9c27b0
const PRIMARY_LIGHT = "rgb(var(--mui-purple-300))"; // #ba68c8
const PRIMARY_DARK = "rgb(var(--mui-purple-700))"; // #7b1fa2
const SECONDARY = "rgb(var(--mui-deep-purple-400))"; // #7e57c2
const SECONDARY_LIGHT = "rgb(var(--mui-deep-purple-200))"; // #b39ddb
const SECONDARY_DARK = "rgb(var(--mui-deep-purple-600))"; // #5e35b1
const BG_DEFAULT = "rgb(var(--mui-purple-50))"; // #f3e5f5
const BG_PAPER = "#FFFFFF";
const TEXT_PRIMARY = "rgb(var(--mui-purple-900))"; // #4a148c
const TEXT_SECONDARY = "rgb(var(--mui-purple-400))"; // #ab47bc
const TEAL = "rgb(var(--mui-teal-500))"; // #009688
const YELLOW = "rgb(var(--mui-yellow-700))"; // #fbc02d
const ERROR = "rgb(var(--mui-red-500))"; // #f44336

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: PRIMARY,
      light: PRIMARY_LIGHT,
      dark: PRIMARY_DARK,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: SECONDARY,
      light: SECONDARY_LIGHT,
      dark: SECONDARY_DARK,
      contrastText: "#FFFFFF",
    },
    background: {
      default: BG_DEFAULT,
      paper: BG_PAPER,
    },
    text: {
      primary: TEXT_PRIMARY,
      secondary: TEXT_SECONDARY,
    },
    divider: "rgba(var(--mui-purple-500), 0.18)",
    error: { main: ERROR },
    success: { main: TEAL },
    warning: { main: YELLOW },
  },
  typography: {
    fontFamily: "var(--font-body)",
    h1: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h2: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h3: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h4: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h5: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    h6: { fontFamily: "var(--font-heading)", fontWeight: 700 },
    button: { fontWeight: 700 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "html, body, #root": {
          backgroundColor: BG_DEFAULT,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: "100px",
          fontWeight: 700,
          fontSize: "0.95rem",
          letterSpacing: "0.02em",
          transition:
            "transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease",
          "&:hover": {
            transform: "scale(1.06) translateY(-1px)",
          },
          "&:active": {
            transform: "scale(0.96)",
          },
        },
        sizeLarge: {
          padding: "13px 36px",
          fontSize: "1rem",
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${PRIMARY_LIGHT} 0%, ${PRIMARY} 50%, ${PRIMARY_DARK} 100%)`,
          backgroundSize: "200% 200%",
          color: "#FFFFFF",
          boxShadow: `0 4px 20px rgba(var(--mui-purple-500), 0.4)`,
          "&:hover": {
            boxShadow: `0 8px 30px rgba(var(--mui-purple-500), 0.55)`,
            backgroundPosition: "right center",
          },
          "&.Mui-disabled": {
            background: "rgba(var(--mui-purple-500), 0.15)",
            color: "rgba(var(--mui-purple-500), 0.4)",
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${SECONDARY_LIGHT} 0%, ${SECONDARY} 100%)`,
          color: "#FFFFFF",
          boxShadow: `0 4px 20px rgba(var(--mui-deep-purple-500), 0.4)`,
          "&:hover": {
            boxShadow: `0 8px 30px rgba(var(--mui-deep-purple-500), 0.55)`,
          },
        },
        outlinedPrimary: {
          borderColor: PRIMARY,
          borderWidth: "2px",
          color: PRIMARY,
          "&:hover": {
            borderWidth: "2px",
            borderColor: PRIMARY,
            backgroundColor: "rgba(var(--mui-purple-500), 0.08)",
          },
        },
        textPrimary: {
          color: PRIMARY,
          "&:hover": {
            backgroundColor: "rgba(var(--mui-purple-500), 0.08)",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: "16px",
            backgroundColor: "rgba(var(--mui-purple-50), 0.5)",
            transition: "box-shadow 0.2s ease",
            "& fieldset": {
              borderColor: "rgba(var(--mui-purple-500), 0.25)",
              borderWidth: "2px",
            },
            "&:hover fieldset": {
              borderColor: PRIMARY,
            },
            "&.Mui-focused": {
              boxShadow: `0 0 0 3px rgba(var(--mui-purple-500), 0.15)`,
            },
            "&.Mui-focused fieldset": {
              borderColor: PRIMARY,
              borderWidth: "2px",
            },
          },
          "& .MuiInputLabel-root.Mui-focused": {
            color: PRIMARY,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 100,
          height: 8,
          backgroundColor: "rgba(var(--mui-purple-500), 0.12)",
          overflow: "hidden",
        },
        bar: {
          background: `linear-gradient(90deg, ${PRIMARY_LIGHT}, ${PRIMARY}, ${SECONDARY}, ${PRIMARY_DARK}, ${PRIMARY_LIGHT})`,
          backgroundSize: "300% 100%",
          animation: "shimmer 2s linear infinite",
          borderRadius: 100,
        },
      },
    },
    MuiCircularProgress: {
      defaultProps: { color: "primary" },
      styleOverrides: {
        root: {
          filter: "drop-shadow(0 0 4px rgba(var(--mui-purple-500), 0.5))",
        },
        circle: {
          strokeLinecap: "round",
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: "16px",
          fontSize: "0.9rem",
          fontWeight: 600,
          border: "2px solid transparent",
        },
        standardError: {
          backgroundColor: "rgba(var(--mui-red-500), 0.1)",
          color: "rgb(var(--mui-red-900))",
          border: "2px solid rgba(var(--mui-red-500), 0.3)",
          "& .MuiAlert-icon": { color: ERROR },
        },
        standardSuccess: {
          backgroundColor: "rgba(var(--mui-teal-500), 0.1)",
          color: "rgb(var(--mui-teal-900))",
          border: `2px solid rgba(var(--mui-teal-500), 0.3)`,
          "& .MuiAlert-icon": { color: TEAL },
        },
        standardWarning: {
          backgroundColor: "rgba(var(--mui-yellow-700), 0.1)",
          color: "rgb(var(--mui-yellow-900))",
          border: "2px solid rgba(var(--mui-yellow-700), 0.3)",
          "& .MuiAlert-icon": { color: YELLOW },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(var(--mui-purple-500), 0.18)",
          borderStyle: "dashed",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: "14px",
          transition:
            "transform 0.15s cubic-bezier(0.34,1.56,0.64,1), background-color 0.15s ease",
          "&:hover": {
            transform: "scale(1.15) rotate(-5deg)",
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: "10px",
          fontWeight: 600,
          fontSize: "0.78rem",
          backgroundColor: TEXT_PRIMARY,
        },
      },
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (sessionStorage.getItem(ADMIN_AUTH_KEY) !== "1") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminPage />
                </RequireAuth>
              }
            />
            <Route path="/event/:slug" element={<EventPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
