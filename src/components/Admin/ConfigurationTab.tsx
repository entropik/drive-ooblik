import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";  
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Settings, 
  TestTube, 
  Save, 
  CheckCircle, 
  XCircle, 
  Loader2,
  FileText,
  Eye
} from "lucide-react";

interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  multipartUploads: boolean;
  allowedExtensions: string[];
}

interface NamingConfig {
  schema: string;
  prefix: string;
  lowercase: boolean;
  replaceSpacesWithDash: boolean;
  stripAccents: boolean;
  maxLength: number;
}

export default function ConfigurationTab() {
  const [s3Config, setS3Config] = useState<S3Config>({
    accessKeyId: "",
    secretAccessKey: "",
    region: "eu-west-3",
    bucketName: "",
    multipartUploads: true,
    allowedExtensions: ["jpg", "jpeg", "png", "pdf", "doc", "docx", "zip", "rar"]
  });

  const [namingConfig, setNamingConfig] = useState<NamingConfig>({
    schema: "{yyyy}/{mm}/{space}/{basename}-{uuid}.{ext}",
    prefix: "",
    lowercase: true,
    replaceSpacesWithDash: true,
    stripAccents: true,
    maxLength: 255
  });

  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      
      // Récupérer le token de session admin depuis le localStorage
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        console.error('No admin session found');
        return;
      }

      // Récupérer la configuration S3
      const { data: s3Data } = await supabase.functions.invoke('admin-config', {
        body: { action: 'get_config', key: 's3_config' },
        headers: {
          'x-admin-session': adminSession
        }
      });

      if (s3Data?.success && s3Data.value) {
        setS3Config(s3Data.value);
      }

      // Récupérer la configuration de nommage  
      const { data: namingData } = await supabase.functions.invoke('admin-config', {
        body: { action: 'get_config', key: 'naming_schema' },
        headers: {
          'x-admin-session': adminSession
        }
      });

      if (namingData?.success && namingData.value) {
        setNamingConfig(namingData.value);
      }

    } catch (error) {
      console.error('Erreur chargement config:', error);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setLoading(false);
    }
  };

  const testS3Connection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Simuler un test de connexion S3
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Dans un vrai cas, on ferait un appel à l'API S3
      if (s3Config.accessKeyId && s3Config.secretAccessKey && s3Config.bucketName) {
        setConnectionStatus('success');
        toast.success("Connexion S3 réussie !");
      } else {
        throw new Error("Configuration S3 incomplète");
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error("Échec de la connexion S3");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    
    try {
      // Récupérer le token de session admin depuis le localStorage
      const adminSession = localStorage.getItem('admin_session');
      if (!adminSession) {
        throw new Error('Session admin non trouvée');
      }

      // Sauvegarder la config S3
      const { data: s3Response } = await supabase.functions.invoke('admin-config', {
        body: { 
          action: 'save_config', 
          key: 's3_config', 
          value: s3Config 
        },
        headers: {
          'x-admin-session': adminSession
        }
      });

      if (!s3Response?.success) {
        throw new Error('Erreur sauvegarde config S3');
      }

      // Sauvegarder la config de nommage
      const { data: namingResponse } = await supabase.functions.invoke('admin-config', {
        body: { 
          action: 'save_config', 
          key: 'naming_schema', 
          value: namingConfig 
        },
        headers: {
          'x-admin-session': adminSession
        }
      });

      if (!namingResponse?.success) {
        throw new Error('Erreur sauvegarde schéma nommage');
      }

      toast.success("Configuration sauvegardée avec succès !");
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const generatePreview = () => {
    const now = new Date();
    const variables = {
      '{yyyy}': now.getFullYear().toString(),
      '{mm}': (now.getMonth() + 1).toString().padStart(2, '0'),
      '{dd}': now.getDate().toString().padStart(2, '0'),
      '{HH}': now.getHours().toString().padStart(2, '0'),
      '{ii}': now.getMinutes().toString().padStart(2, '0'),
      '{ss}': now.getSeconds().toString().padStart(2, '0'),
      '{uuid}': 'abc123de-f456-7890-ghij-klmnopqrstuv',
      '{random8}': 'A1B2C3D4',
      '{email}': 'client@example.com',
      '{user}': 'client-example-com',
      '{space}': 'mon-client-entreprise',
      '{order_id}': 'CMD-2024-001',
      '{filename}': 'document-important.pdf',
      '{ext}': 'pdf',
      '{basename}': 'document-important'
    };

    let preview = namingConfig.prefix + namingConfig.schema;
    Object.entries(variables).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    // Appliquer les options de normalisation
    if (namingConfig.lowercase) {
      preview = preview.toLowerCase();
    }
    if (namingConfig.replaceSpacesWithDash) {
      preview = preview.replace(/\s+/g, '-');
    }
    if (namingConfig.stripAccents) {
      preview = preview.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    if (namingConfig.maxLength > 0 && preview.length > namingConfig.maxLength) {
      preview = preview.substring(0, namingConfig.maxLength);
    }

    return preview;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Chargement de la configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuration</h2>
        <p className="text-muted-foreground">
          Configurez les paramètres S3 et le schéma de nommage des fichiers.
        </p>
      </div>

      {/* Configuration AWS S3 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration AWS S3
          </CardTitle>
          <CardDescription>
            Paramètres de connexion au bucket S3 pour le stockage des fichiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accessKeyId">Access Key ID</Label>
              <Input
                id="accessKeyId"
                type="password"
                value={s3Config.accessKeyId}
                onChange={(e) => setS3Config({...s3Config, accessKeyId: e.target.value})}
                placeholder="AKIA..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">Secret Access Key</Label>
              <Input
                id="secretAccessKey"
                type="password"
                value={s3Config.secretAccessKey}
                onChange={(e) => setS3Config({...s3Config, secretAccessKey: e.target.value})}
                placeholder="wJalrXUtnFEMI/K7MDENG..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Région</Label>
              <Input
                id="region"
                value={s3Config.region}
                onChange={(e) => setS3Config({...s3Config, region: e.target.value})}
                placeholder="eu-west-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bucketName">Nom du bucket</Label>
              <Input
                id="bucketName"
                value={s3Config.bucketName}
                onChange={(e) => setS3Config({...s3Config, bucketName: e.target.value})}
                placeholder="mon-bucket-uploads"
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="multipart"
                checked={s3Config.multipartUploads}
                onCheckedChange={(checked) => setS3Config({...s3Config, multipartUploads: checked})}
              />
              <Label htmlFor="multipart">Uploads multipart (recommandé pour gros fichiers)</Label>
            </div>
            
            <div className="space-y-2">
              <Label>Extensions autorisées</Label>
              <div className="flex flex-wrap gap-2">
                {s3Config.allowedExtensions.map(ext => (
                  <Badge key={ext} variant="secondary">{ext}</Badge>
                ))}
              </div>
              <Input
                placeholder="Ajouter une extension (ex: mp4)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const ext = (e.target as HTMLInputElement).value.toLowerCase();
                    if (ext && !s3Config.allowedExtensions.includes(ext)) {
                      setS3Config({
                        ...s3Config, 
                        allowedExtensions: [...s3Config.allowedExtensions, ext]
                      });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration du schéma de nommage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Schéma de nommage S3
          </CardTitle>
          <CardDescription>
            Configurez la structure de nommage des fichiers dans S3.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schema">Schéma de nommage</Label>
            <Textarea
              id="schema"
              value={namingConfig.schema}
              onChange={(e) => setNamingConfig({...namingConfig, schema: e.target.value})}
              placeholder="{yyyy}/{mm}/{space}/{basename}-{uuid}.{ext}"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Variables: {'{yyyy}{mm}{dd}{HH}{ii}{ss}{uuid}{random8}{email}{user}{space}{order_id}{filename}{ext}{basename}'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prefix">Préfixe (optionnel)</Label>
            <Input
              id="prefix"
              value={namingConfig.prefix}
              onChange={(e) => setNamingConfig({...namingConfig, prefix: e.target.value})}
              placeholder="uploads/"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="lowercase"
                checked={namingConfig.lowercase}
                onCheckedChange={(checked) => setNamingConfig({...namingConfig, lowercase: checked})}
              />
              <Label htmlFor="lowercase" className="text-sm">Minuscules</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="replaceSpaces"
                checked={namingConfig.replaceSpacesWithDash}
                onCheckedChange={(checked) => setNamingConfig({...namingConfig, replaceSpacesWithDash: checked})}
              />
              <Label htmlFor="replaceSpaces" className="text-sm">Espaces → tirets</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="stripAccents"
                checked={namingConfig.stripAccents}
                onCheckedChange={(checked) => setNamingConfig({...namingConfig, stripAccents: checked})}
              />
              <Label htmlFor="stripAccents" className="text-sm">Suppr. accents</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLength" className="text-sm">Longueur max</Label>
              <Input
                id="maxLength"
                type="number"
                value={namingConfig.maxLength}
                onChange={(e) => setNamingConfig({...namingConfig, maxLength: parseInt(e.target.value) || 255})}
                min="50"
                max="1000"
              />
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4" />
              <Label className="font-medium">Aperçu temps réel</Label>
            </div>
            <code className="text-sm break-all">{generatePreview()}</code>
          </div>
        </CardContent>
      </Card>

      {/* Test et sauvegarde */}
      <Card>
        <CardHeader>
          <CardTitle>Test & Sauvegarde</CardTitle>
          <CardDescription>
            Testez la connexion S3 et sauvegardez votre configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={testS3Connection}
              disabled={isTestingConnection}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isTestingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Tester la connexion S3
            </Button>

            {connectionStatus === 'success' && (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span>Connexion réussie</span>
              </div>
            )}

            {connectionStatus === 'error' && (
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>Connexion échouée</span>
              </div>
            )}
          </div>

          <Button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Sauvegarder la configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}