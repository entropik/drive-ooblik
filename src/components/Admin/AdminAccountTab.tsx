import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Mail, Key, Loader2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
}

export default function AdminAccountTab() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const [emailData, setEmailData] = useState({
    email: ""
  });

  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false
  });

  useEffect(() => {
    fetchAdminUser();
  }, []);

  const fetchAdminUser = async () => {
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
        if (data.user) {
          setAdminUser(data.user);
          setEmailData({ email: data.user.email || "" });
        }
      }
    } catch (error) {
      console.error('Erreur récupération admin:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les informations du compte",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('admin_session');
      const response = await fetch('https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/admin-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'update_password',
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        toast({
          title: "Mot de passe mis à jour",
          description: "Votre mot de passe a été modifié avec succès"
        });
        setPasswordData({ newPassword: "", confirmPassword: "" });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Erreur de mise à jour');
      }
    } catch (error) {
      console.error('Erreur mise à jour mot de passe:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour le mot de passe",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateEmail = async () => {
    if (!emailData.email) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une adresse email",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.email)) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une adresse email valide",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('admin_session');
      const response = await fetch('https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/admin-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'update_email',
          email: emailData.email
        })
      });

      if (response.ok) {
        toast({
          title: "Email mis à jour",
          description: "Votre adresse email professionnelle a été mise à jour"
        });
        if (adminUser) {
          setAdminUser({ ...adminUser, email: emailData.email });
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Erreur de mise à jour');
      }
    } catch (error) {
      console.error('Erreur mise à jour email:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour l'email",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
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
        <h2 className="text-2xl font-bold">Compte administrateur</h2>
        <p className="text-muted-foreground">
          Gérez votre mot de passe et votre adresse email professionnelle.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations actuelles */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Informations du compte
            </CardTitle>
            <CardDescription>
              Votre compte administrateur actuel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Nom d'utilisateur</Label>
                <p className="text-sm text-muted-foreground">{adminUser?.username}</p>
              </div>
              <Badge variant="secondary" className="w-fit">Administrateur</Badge>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email professionnel</Label>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {adminUser?.email || "Aucun email configuré"}
                </p>
                {adminUser?.email && <Mail className="h-4 w-4 text-green-500" />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modification du mot de passe */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Changer le mot de passe
            </CardTitle>
            <CardDescription>
              Mettez à jour votre mot de passe administrateur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  placeholder="Minimum 8 caractères"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  placeholder="Répétez le nouveau mot de passe"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              onClick={updatePassword} 
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                "Mettre à jour le mot de passe"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Configuration email professionnel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Adresse email professionnelle
            </CardTitle>
            <CardDescription>
              Configurez votre email pour les notifications et envois SMTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Adresse email</Label>
              <Input
                id="adminEmail"
                type="email"
                value={emailData.email}
                onChange={(e) => setEmailData({...emailData, email: e.target.value})}
                placeholder="admin@votre-domaine.com"
              />
              <p className="text-xs text-muted-foreground">
                Cette adresse sera utilisée comme expéditeur pour les emails SMTP
              </p>
            </div>

            <Button 
              onClick={updateEmail} 
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                "Mettre à jour l'email"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}