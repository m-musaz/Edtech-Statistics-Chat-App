import React from "react";
import ProtectedAdminRoute from "./ProtectedAdminRoute";
import AdminHeader from "./AdminHeader";
import { Outlet } from "react-router-dom";

const AdminLayout: React.FC = () => {
  return (
    <ProtectedAdminRoute>
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="px-6">
          <Outlet />
        </div>
      </div>
    </ProtectedAdminRoute>
  );
};

export default AdminLayout;


