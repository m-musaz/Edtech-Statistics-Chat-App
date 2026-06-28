import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import ChatPage from "./pages/ChatPage";
import PlanChatPage from "./pages/PlanChatPage";
import AboutPage from "./pages/AboutPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminDashboard from "./components/Admin/Dashboard";
import AdminLoginPage from "./pages/AdminLoginPage";
import SettingsPage from "./components/Admin/SettingsPage";
import AdminLayout from "./components/Admin/AdminLayout";

const AdminRoutes = () => (
  <AdminAuthProvider>
    <Routes>
      <Route path="login" element={<AdminLoginPage />} />
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  </AdminAuthProvider>
);

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:threadId" element={<ChatPage />} />
          <Route path="/plan-3321" element={<PlanChatPage />} />
          <Route path="/plan-3321/:threadId" element={<PlanChatPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;