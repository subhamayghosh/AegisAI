import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Inspect from "./pages/Inspect";
import History from "./pages/History";
import HistoryDetail from "./pages/HistoryDetail";
import Sessions from "./pages/Sessions";
import SessionDetail from "./pages/SessionDetail";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import AuditLog from "./pages/AuditLog";
import NotFound from "./pages/NotFound";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/inspect", element: <Inspect /> },
          { path: "/history", element: <History /> },
          { path: "/history/:id", element: <HistoryDetail /> },
          { path: "/sessions", element: <Sessions /> },
          { path: "/sessions/:id", element: <SessionDetail /> },
          { path: "/settings", element: <Settings /> },
          { path: "/profile", element: <Profile /> },
          {
            element: <ProtectedRoute adminOnly />,
            children: [{ path: "/audit", element: <AuditLog /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
]);

export default router;
