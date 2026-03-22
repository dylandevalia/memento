import { CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import { ADMIN_AUTH_KEY } from "./lib/auth";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import UploadPage from "./pages/UploadPage";

const GOLD = "#C8A96E";
const GOLD_LIGHT = "#D9BC88";
const BG_DEFAULT = "#0D0D10";
const BG_PAPER = "#15151D";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: GOLD,
      light: GOLD_LIGHT,
      dark: "#A8894E",
      contrastText: "#0D0D10",
    },
    background: {
      default: BG_DEFAULT,
      paper: BG_PAPER,
    },
    text: {
      primary: "#EDE8E1",
      secondary: "#7A7480",
    },
    divider: "rgba(200, 169, 110, 0.12)",
    error: { main: "#D97070" },
    success: { main: "#78A99A" },
  },
  typography: {
    fontFamily: '"Roboto", system-ui, sans-serif',
    h1: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 400,
    },
    h2: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 400,
    },
    h3: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 400,
    },
    h4: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 400,
    },
    h5: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 400,
    },
    h6: {
      fontFamily: '"Playfair Display", Georgia, serif',
      fontWeight: 400,
    },
  },
  shape: { borderRadius: 4 },
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
          letterSpacing: "0.07em",
          fontWeight: 500,
          fontSize: "0.875rem",
        },
        sizeLarge: {
          padding: "13px 32px",
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 100%)`,
          color: "#0D0D10",
          boxShadow: "0 4px 20px rgba(200, 169, 110, 0.28)",
          "&:hover": {
            background: `linear-gradient(135deg, #E2C994 0%, ${GOLD_LIGHT} 100%)`,
            boxShadow: "0 6px 28px rgba(200, 169, 110, 0.38)",
          },
          "&.Mui-disabled": {
            background: "rgba(200, 169, 110, 0.15)",
            color: "rgba(200, 169, 110, 0.35)",
          },
        },
        outlinedPrimary: {
          borderColor: "rgba(200, 169, 110, 0.4)",
          color: GOLD,
          "&:hover": {
            borderColor: GOLD,
            backgroundColor: "rgba(200, 169, 110, 0.07)",
          },
        },
        textPrimary: {
          color: GOLD,
          "&:hover": {
            backgroundColor: "rgba(200, 169, 110, 0.07)",
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: "10px",
            "& fieldset": {
              borderColor: "rgba(200, 169, 110, 0.18)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(200, 169, 110, 0.38)",
            },
            "&.Mui-focused fieldset": {
              borderColor: GOLD,
              borderWidth: "1px",
            },
          },
          "& .MuiInputLabel-root.Mui-focused": {
            color: GOLD,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 100,
          height: 2,
          backgroundColor: "rgba(200, 169, 110, 0.1)",
        },
        bar: {
          background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
        },
      },
    },
    MuiCircularProgress: {
      defaultProps: { color: "primary" },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: "10px",
          fontSize: "0.85rem",
        },
        standardError: {
          backgroundColor: "rgba(217, 112, 112, 0.1)",
          color: "#D97070",
          border: "1px solid rgba(217, 112, 112, 0.2)",
          "& .MuiAlert-icon": { color: "#D97070" },
        },
        standardSuccess: {
          backgroundColor: "rgba(120, 169, 154, 0.1)",
          color: "#78A99A",
          border: "1px solid rgba(120, 169, 154, 0.2)",
          "& .MuiAlert-icon": { color: "#78A99A" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: BG_PAPER,
          border: "1px solid rgba(200, 169, 110, 0.1)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "rgba(200, 169, 110, 0.12)",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: "10px",
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
        <Route path="/upload/:slug" element={<UploadPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
