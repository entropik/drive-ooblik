import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "@/components/Layout/AdminLayout";
import ConfigurationTab from "@/components/Admin/ConfigurationTab";
import FilesTab from "@/components/Admin/FilesTab";
import LogsTab from "@/components/Admin/LogsTab";  
import DiagnosticTab from "@/components/Admin/DiagnosticTab";
import AdminAccountTab from "@/components/Admin/AdminAccountTab";
import SMTPConfigTab from "@/components/Admin/SMTPConfigTab";
import AdminLogin from "@/components/Admin/AdminLogin";
import SessionExpiredDialog from "@/components/Admin/SessionExpiredDialog";
import { toast } from "sonner";

const Admin = () => {
  const [activeTab, setActiveTab] = useState<"account" | "smtp" | "config" | "files" | "logs" | "diagnostic">("account");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionExpirationTime, setSessionExpirationTime] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('admin_session');
      const response = await fetch(`https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/admin-auth/verify`, {
        method: 'GET',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        setSessionExpired(false);
        
        if (data.user) {
          console.log('Session valide pour:', data.user.username);
        }
      } else {
        const errorData = await response.json();
        if (response.status === 401) {
          localStorage.removeItem('admin_session');
          setSessionExpired(true);
          setIsAuthenticated(false);
          if (errorData.error?.includes('expirée')) {
            toast.error("Votre session a expiré, veuillez vous reconnecter");
          }
        }
      }
    } catch (error) {
      console.error('Erreur vérification auth:', error);
      setSessionExpired(true);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setSessionExpired(false);
    setSessionExpirationTime(null);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('admin_session');
      await fetch(`https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/admin-auth/logout`, {
        method: 'POST',
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        }
      });
    } catch (error) {
      console.error('Erreur logout:', error);
    } finally {
      localStorage.removeItem('admin_session');
      setIsAuthenticated(false);
      setSessionExpired(false);
      setSessionExpirationTime(null);
      navigate('/');
    }
  };

  const handleSessionExpiredClose = () => {
    setSessionExpired(false);
    setIsAuthenticated(false);
    setSessionExpirationTime(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <AdminLogin onSuccess={handleLoginSuccess} />
        <SessionExpiredDialog 
          isOpen={sessionExpired}
          onClose={handleSessionExpiredClose}
          expirationTime={sessionExpirationTime || undefined}
        />
      </>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "account":
        return <AdminAccountTab />;
      case "smtp":
        return <SMTPConfigTab />;
      case "config":
        return <ConfigurationTab />;
      case "files":
        return <FilesTab />;
      case "logs":
        return <LogsTab />;
      case "diagnostic":
        return <DiagnosticTab />;
      default:
        return <AdminAccountTab />;
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