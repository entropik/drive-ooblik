import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, Mail, Server, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface SMTPConfig {
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
}

export default function SMTPConfigTab() {
  const [config, setConfig] = useState<SMTPConfig>({
    provider: "fastmail",
    host: "smtp.fastmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "",
      pass: ""
    },
    from: {
      name: "Plateforme Upload",
      address: ""
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"success" | "error" | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSMTPConfig();
  }, []);

  const loadSMTPConfig = async () => {
    try {
      const token = localStorage.getItem('admin_session');
      const response = await fetch('https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          ...(token ? { 'X-Admin-Session': token } : {}),
        },
        body: JSON.stringify({
          action: 'get_config',
          key: 'smtp_config'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setConfig(result.data as SMTPConfig);
        }
      } else {
        throw new Error('Failed to load SMTP config');
      }
    } catch (error) {
      console.error('Erreur chargement config SMTP:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger la configuration SMTP",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSMTPConfig = async () => {

    setIsSaving(true);
    try {
      const token = localStorage.getItem('admin_session');
      const response = await fetch('https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/admin-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          ...(token ? { 'X-Admin-Session': token } : {}),
        },
        body: JSON.stringify({
          action: 'save_config',
          key: 'smtp_config',
          value: config
        })
      });

      if (response.ok) {
        toast({
          title: "Configuration sauvegardée",
          description: "Les paramètres SMTP ont été mis à jour avec succès"
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Erreur de sauvegarde');
      }
    } catch (error) {
      console.error('Erreur sauvegarde SMTP:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder la configuration",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testSMTPConnection = async () => {
    if (!testEmail) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une adresse email de test",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestStatus(null);

    try {
      const token = localStorage.getItem('admin_session');
      const response = await fetch('https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/test-smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: testEmail,
          config: config
        })
      });

      const result = await response.json();

      if (response.ok) {
        setTestStatus("success");
        toast({
          title: "Test réussi",
          description: `Email de test envoyé avec succès à ${testEmail}`
        });
      } else {
        setTestStatus("error");
        throw new Error(result.error || 'Erreur de test SMTP');
      }
    } catch (error) {
      setTestStatus("error");
      console.error('Erreur test SMTP:', error);
      toast({
        title: "Test échoué",
        description: error instanceof Error ? error.message : "Impossible d'envoyer l'email de test",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const updateConfig = (updates: Partial<SMTPConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateAuth = (updates: Partial<SMTPConfig['auth']>) => {
    setConfig(prev => ({ ...prev, auth: { ...prev.auth, ...updates } }));
  };

  const updateFrom = (updates: Partial<SMTPConfig['from']>) => {
    setConfig(prev => ({ ...prev, from: { ...prev.from, ...updates } }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuration SMTP</h2>
        <p className="text-muted-foreground">
          Configurez votre serveur SMTP pour l'envoi d'emails automatiques.
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Pour Fastmail, vous devez utiliser un <strong>mot de passe d'application</strong> au lieu de votre mot de passe principal. 
          Créez-en un dans les paramètres de sécurité de votre compte Fastmail.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration du serveur */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Paramètres du serveur
            </CardTitle>
            <CardDescription>
              Configuration de connexion au serveur SMTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Fournisseur</Label>
                <Select value={config.provider} onValueChange={(value) => {
                  if (value === "fastmail") {
                    updateConfig({
                      provider: value,
                      host: "smtp.fastmail.com",
                      port: 465,
                      secure: true
                    });
                  } else if (value === "gmail") {
                    updateConfig({
                      provider: value,
                      host: "smtp.gmail.com",
                      port: 587,
                      secure: false
                    });
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fastmail">Fastmail</SelectItem>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="custom">Personnalisé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="host">Serveur SMTP</Label>
                <Input
                  id="host"
                  value={config.host}
                  onChange={(e) => updateConfig({ host: e.target.value })}
                  placeholder="smtp.fastmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Select value={config.port.toString()} onValueChange={(value) => updateConfig({ port: parseInt(value) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="465">465 (SSL)</SelectItem>
                    <SelectItem value="587">587 (STARTTLS)</SelectItem>
                    <SelectItem value="25">25 (non sécurisé)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label>Connexion sécurisée (SSL/TLS)</Label>
                </div>
                <Switch
                  checked={config.secure}
                  onCheckedChange={(checked) => updateConfig({ secure: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentification et expéditeur */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Authentification</CardTitle>
            <CardDescription>
              Identifiants de connexion au serveur SMTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nom d'utilisateur / Email</Label>
                <Input
                  id="username"
                  type="email"
                  value={config.auth.user}
                  onChange={(e) => updateAuth({ user: e.target.value })}
                  placeholder="votre-email@fastmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe d'application</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={config.auth.pass}
                    onChange={(e) => updateAuth({ pass: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="fromName">Nom de l'expéditeur</Label>
                <Input
                  id="fromName"
                  value={config.from.name}
                  onChange={(e) => updateFrom({ name: e.target.value })}
                  placeholder="Plateforme Upload"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromAddress">Adresse email expéditeur</Label>
                <Input
                  id="fromAddress"
                  type="email"
                  value={config.from.address}
                  onChange={(e) => updateFrom({ address: e.target.value })}
                  placeholder="noreply@votre-domaine.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test et sauvegarde */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Test et sauvegarde
            </CardTitle>
            <CardDescription>
              Testez votre configuration avant de la sauvegarder
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {testStatus && (
              <div className="mb-4">
                {testStatus === "success" && (
                  <Badge variant="default" className="bg-green-500 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Test réussi
                  </Badge>
                )}
                {testStatus === "error" && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Test échoué
                  </Badge>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="testEmail">Email de test</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@exemple.com"
              />
            </div>

            <Button 
              onClick={testSMTPConnection} 
              disabled={isTesting}
              className="w-full"
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Envoyer un email de test
                </>
              )}
            </Button>
            
            <Separator />

            <Button 
              onClick={saveSMTPConfig} 
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                "Sauvegarder la configuration SMTP"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}