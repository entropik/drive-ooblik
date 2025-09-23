import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import MagicLinkForm from "@/components/Public/MagicLinkForm";
import FileUploadZone from "@/components/Public/FileUploadZone";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userSession, setUserSession] = useState<{
    email: string;
    space_name: string;
    token: string;
  } | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Vérifier si on arrive via un lien magic
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    const space = urlParams.get('space');
    
    if (token && space) {
      // Simuler l'authentification réussie
      setUserSession({
        email: 'user@example.com', // En réalité, récupéré depuis l'API
        space_name: decodeURIComponent(space),
        token
      });
      setIsAuthenticated(true);
      
      // Nettoyer l'URL
      window.history.replaceState({}, '', '/');
    }
  }, [location]);

  const handleMagicLinkSuccess = (data: { email: string; space_name: string; token?: string }) => {
    if (data.token) {
      // En développement, on peut utiliser le token directement
      setUserSession({
        email: data.email,
        space_name: data.space_name,
        token: data.token
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
      magicToken={userSession.token}
      onComplete={handleUploadComplete}
    />
  );
};

export default Index;