// Gestionnaire de session pour remplacer l'authentification Supabase
import { apiService } from './api';

export interface SessionData {
  spaceId: string;
  spaceName: string;
  email: string;
  expiresAt: string;
  isActive: boolean;
}

export interface AdminSessionData {
  id: string;
  username: string;
  email: string;
}

class SessionManager {
  private sessionData: SessionData | null = null;
  private adminSessionData: AdminSessionData | null = null;

  // === Session utilisateur ===

  // Initialiser la session depuis l'URL (après auth-consume)
  initSessionFromUrl(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionToken = urlParams.get('session');
    const spaceName = urlParams.get('space');
    const error = urlParams.get('error');

    if (error) {
      console.error('Erreur d\'authentification:', error);
      return false;
    }

    if (sessionToken && spaceName) {
      apiService.setSessionToken(sessionToken);

      // Nettoyer l'URL
      const cleanUrl = window.location.href.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);

      return true;
    }

    return false;
  }

  // Vérifier et charger la session
  async loadSession(): Promise<boolean> {
    const sessionToken = apiService.getSessionToken();

    if (!sessionToken) {
      return false;
    }

    try {
      const response = await apiService.verifySession();

      if (response.success && response.session) {
        this.sessionData = response.session;
        return true;
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de session:', error);
      // Token invalide, le nettoyer
      apiService.setSessionToken(null);
    }

    return false;
  }

  // Obtenir les données de session
  getSessionData(): SessionData | null {
    return this.sessionData;
  }

  // Vérifier si l'utilisateur est connecté
  isUserLoggedIn(): boolean {
    return !!this.sessionData && !!apiService.getSessionToken();
  }

  // Déconnexion utilisateur
  logoutUser() {
    this.sessionData = null;
    apiService.setSessionToken(null);
  }

  // === Session admin ===

  // Connexion admin
  async loginAdmin(username: string, password: string): Promise<boolean> {
    try {
      const response = await apiService.adminLogin(username, password);

      if (response.success && response.user) {
        this.adminSessionData = response.user;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erreur lors de la connexion admin:', error);
      return false;
    }
  }

  // Vérifier et charger la session admin
  async loadAdminSession(): Promise<boolean> {
    const adminToken = apiService.getAdminToken();

    if (!adminToken) {
      return false;
    }

    try {
      const response = await apiService.verifyAdminSession();

      if (response.success && response.user) {
        this.adminSessionData = response.user;
        return true;
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de session admin:', error);
      // Token invalide, le nettoyer
      apiService.setAdminToken(null);
    }

    return false;
  }

  // Obtenir les données de session admin
  getAdminSessionData(): AdminSessionData | null {
    return this.adminSessionData;
  }

  // Vérifier si l'admin est connecté
  isAdminLoggedIn(): boolean {
    return !!this.adminSessionData && !!apiService.getAdminToken();
  }

  // Déconnexion admin
  async logoutAdmin(): Promise<boolean> {
    try {
      await apiService.adminLogout();
      this.adminSessionData = null;
      return true;
    } catch (error) {
      console.error('Erreur lors de la déconnexion admin:', error);
      // Nettoyer quand même les données locales
      this.adminSessionData = null;
      apiService.setAdminToken(null);
      return false;
    }
  }

  // === Méthodes utilitaires ===

  // Initialiser le gestionnaire de session
  async init(): Promise<void> {
    // Vérifier s'il y a des paramètres d'URL (redirection après auth)
    this.initSessionFromUrl();

    // Charger les sessions existantes
    await Promise.all([
      this.loadSession(),
      this.loadAdminSession()
    ]);
  }

  // Nettoyer toutes les sessions
  clearAllSessions() {
    this.sessionData = null;
    this.adminSessionData = null;
    apiService.clearTokens();
  }

  // Vérifier si une session va expirer bientôt (moins de 30 minutes)
  isSessionExpiringSoon(): boolean {
    if (!this.sessionData) return false;

    const expiresAt = new Date(this.sessionData.expiresAt);
    const now = new Date();
    const thirtyMinutes = 30 * 60 * 1000; // 30 minutes en milliseconds

    return (expiresAt.getTime() - now.getTime()) < thirtyMinutes;
  }

  // Obtenir le temps restant avant expiration (en minutes)
  getTimeUntilExpiration(): number {
    if (!this.sessionData) return 0;

    const expiresAt = new Date(this.sessionData.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();

    return Math.max(0, Math.floor(diffMs / (60 * 1000))); // en minutes
  }

  // Hook pour React - obtenir l'état de la session
  getSessionState() {
    return {
      user: this.sessionData,
      admin: this.adminSessionData,
      isUserLoggedIn: this.isUserLoggedIn(),
      isAdminLoggedIn: this.isAdminLoggedIn(),
      isSessionExpiringSoon: this.isSessionExpiringSoon(),
      timeUntilExpiration: this.getTimeUntilExpiration()
    };
  }
}

// Singleton
export const sessionManager = new SessionManager();

// Export par défaut
export default sessionManager;