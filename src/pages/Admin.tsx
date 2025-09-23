import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/Layout/AdminLayout";
import ConfigurationTab from "@/components/Admin/ConfigurationTab";
import FilesTab from "@/components/Admin/FilesTab";
import LogsTab from "@/components/Admin/LogsTab";  
import DiagnosticTab from "@/components/Admin/DiagnosticTab";
import AdminLogin from "@/components/Admin/AdminLogin";

const Admin = () => {
  const [activeTab, setActiveTab] = useState<"config" | "files" | "logs" | "diagnostic">("config");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth/verify`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Erreur vérification auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        }
      });
    } catch (error) {
      console.error('Erreur logout:', error);
    } finally {
      setIsAuthenticated(false);
      navigate('/');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={handleLoginSuccess} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "config":
        return <ConfigurationTab />;
      case "files":
        return <FilesTab />;
      case "logs":
        return <LogsTab />;
      case "diagnostic":
        return <DiagnosticTab />;
      default:
        return <ConfigurationTab />;
    }
  };

  return (
    <AdminLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export default Admin;