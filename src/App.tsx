import { CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import { Navigate, Route, Routes } from "react-router-dom";
import { ADMIN_AUTH_KEY } from "./lib/auth";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import UploadPage from "./pages/UploadPage";

const theme = createTheme({
  typography: {
    fontFamily: "Roboto, system-ui, sans-serif",
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
