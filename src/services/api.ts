// Service API pour remplacer le client Supabase
class ApiService {
  private baseURL: string;
  private sessionToken: string | null = null;
  private adminToken: string | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

    // Récupérer le token de session depuis le localStorage
    this.sessionToken = localStorage.getItem('session_token');
    this.adminToken = localStorage.getItem('admin_token');
  }

  // Utilitaire pour faire des requêtes HTTP
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Ajouter le token de session si disponible
    if (this.sessionToken) {
      defaultHeaders['x-session-token'] = this.sessionToken;
    }

    // Ajouter le token admin si disponible
    if (this.adminToken) {
      defaultHeaders['x-admin-session'] = this.adminToken;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // Gérer les erreurs HTTP
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Vérifier si la réponse contient du JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      console.error(`Erreur API ${endpoint}:`, error);
      throw error;
    }
  }

  // === Méthodes d'authentification ===

  // Envoyer un lien magique
  async sendMagicLink(email: string, spaceName: string, hcaptchaToken: string) {
    return this.request('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        space_name: spaceName.trim(),
        hcaptcha_token: hcaptchaToken
      })
    });
  }

  // Vérifier une session utilisateur
  async verifySession(sessionToken?: string): Promise<any> {
    const token = sessionToken || this.sessionToken;
    if (!token) {
      throw new Error('Aucun token de session disponible');
    }

    return this.request('/auth/verify', {
      headers: {
        'x-session-token': token
      }
    });
  }

  // Définir le token de session
  setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (token) {
      localStorage.setItem('session_token', token);
    } else {
      localStorage.removeItem('session_token');
    }
  }

  // Obtenir le token de session
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  // === Méthodes d'upload ===

  // Initialiser un upload
  async initUpload(filename: string, fileSize: number, mimeType: string) {
    if (!this.sessionToken) {
      throw new Error('Session requise pour initialiser un upload');
    }

    return this.request('/upload/init', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        file_size: fileSize,
        mime_type: mimeType
      })
    });
  }

  // Finaliser un upload
  async completeUpload(uploadId: string, checksum?: string) {
    if (!this.sessionToken) {
      throw new Error('Session requise pour finaliser un upload');
    }

    return this.request('/upload/complete', {
      method: 'POST',
      body: JSON.stringify({
        upload_id: uploadId,
        checksum
      })
    });
  }

  // Récupérer la liste des fichiers
  async getFiles(page: number = 1, limit: number = 20, status: string = 'all') {
    if (!this.sessionToken) {
      throw new Error('Session requise pour récupérer les fichiers');
    }

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      status
    });

    return this.request(`/upload/files?${params}`);
  }

  // Supprimer un fichier
  async deleteFile(fileId: string) {
    if (!this.sessionToken) {
      throw new Error('Session requise pour supprimer un fichier');
    }

    return this.request(`/upload/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  // === Méthodes d'administration ===

  // Connexion admin
  async adminLogin(username: string, password: string) {
    const response = await this.request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (response.success && response.token) {
      this.setAdminToken(response.token);
    }

    return response;
  }

  // Déconnexion admin
  async adminLogout() {
    const response = await this.request('/admin/logout', {
      method: 'POST'
    });

    this.setAdminToken(null);
    return response;
  }

  // Vérifier une session admin
  async verifyAdminSession() {
    if (!this.adminToken) {
      throw new Error('Aucun token admin disponible');
    }

    return this.request('/admin/verify');
  }

  // Récupérer une configuration
  async getConfig(key: string) {
    return this.request('/admin/config', {
      method: 'POST',
      body: JSON.stringify({
        action: 'get_config',
        key
      })
    });
  }

  // Sauvegarder une configuration
  async saveConfig(key: string, value: any) {
    return this.request('/admin/config', {
      method: 'POST',
      body: JSON.stringify({
        action: 'save_config',
        key,
        value
      })
    });
  }

  // Mettre à jour le profil admin
  async updateAdminProfile(action: string, data: any) {
    return this.request('/admin/update', {
      method: 'POST',
      body: JSON.stringify({
        action,
        ...data
      })
    });
  }

  // Tester la configuration SMTP
  async testSmtp(email: string, config?: any) {
    return this.request('/admin/test-smtp', {
      method: 'POST',
      body: JSON.stringify({
        email,
        config
      })
    });
  }

  // Récupérer le dashboard admin
  async getAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  // Définir le token admin
  setAdminToken(token: string | null) {
    this.adminToken = token;
    if (token) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
  }

  // Obtenir le token admin
  getAdminToken(): string | null {
    return this.adminToken;
  }

  // === Méthodes utilitaires ===

  // Vérifier l'état de santé de l'API
  async healthCheck() {
    return this.request('/health', {
      headers: {} // Pas de token requis pour le health check
    });
  }

  // Nettoyer les tokens
  clearTokens() {
    this.setSessionToken(null);
    this.setAdminToken(null);
  }

  // Vérifier si l'utilisateur est connecté
  isLoggedIn(): boolean {
    return !!this.sessionToken;
  }

  // Vérifier si l'admin est connecté
  isAdminLoggedIn(): boolean {
    return !!this.adminToken;
  }
}

// Singleton
export const apiService = new ApiService();

// Export par défaut
export default apiService;