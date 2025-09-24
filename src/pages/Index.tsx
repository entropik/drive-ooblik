import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import MagicLinkForm from "@/components/Public/MagicLinkForm";
import FileUploadZone from "@/components/Public/FileUploadZone";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userSession, setUserSession] = useState<{
    email: string;
    space_name: string;
    session_token: string; // Use session token instead of magic token
  } | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Check if arriving via secure session (new secure method)
    const urlParams = new URLSearchParams(location.search);
    const session = urlParams.get('session');
    const space = urlParams.get('space');
    
    if (session && space) {
      // Secure session authentication
      setUserSession({
        email: '[PROTECTED]', // Email is now protected and not exposed
        space_name: decodeURIComponent(space),
        session_token: session
      });
      setIsAuthenticated(true);
      
      // Clean URL
      window.history.replaceState({}, '', '/');
    }
    
    // Legacy support for old magic token method (for backwards compatibility)
    const token = urlParams.get('token');
    if (token && space && !session) {
      // Show deprecation warning
      console.warn('Magic token authentication is deprecated for security reasons. Please use the new session-based authentication.');
      setUserSession({
        email: '[PROTECTED]',
        space_name: decodeURIComponent(space),
        session_token: token // Will be treated as session token
      });
      setIsAuthenticated(true);
      window.history.replaceState({}, '', '/');
    }
  }, [location]);

  const handleMagicLinkSuccess = (data: { email: string; space_name: string; token?: string }) => {
    if (data.token) {
      // Development mode - token provided directly (will be phased out)
      setUserSession({
        email: '[PROTECTED]', // Email no longer exposed for security
        space_name: data.space_name,
        session_token: data.token // Treat as session token in dev mode
      });
      setIsAuthenticated(true);
    }
  };

  const handleUploadComplete = (files: any[]) => {
    console.log('Upload terminé:', files);
  };

  if (!isAuthenticated || !userSession) {
    return <MagicLinkForm onSuccess={handleMagicLinkSuccess} />;
  }

  return (
    <FileUploadZone 
      sessionToken={userSession.session_token} // Use session token instead of magic token
      onComplete={handleUploadComplete}
    />
  );
};

export default Index;