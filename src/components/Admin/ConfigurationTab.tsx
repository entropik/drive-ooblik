import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ConfigurationTab() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"success" | "error" | null>(null);
  const { toast } = useToast();

  const [config, setConfig] = useState({
    awsAccessKey: "",
    awsSecretKey: "",
    awsRegion: "eu-west-1",
    bucketName: "",
    enableMultipart: true,
    maxFileSize: "illimité",  // Aucune limite pour les gros fichiers
    allowedTypes: "pdf,jpg,jpeg,png",
  });

  const testS3Connection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    
    // Simuler un test de connexion
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isSuccess = Math.random() > 0.3; // 70% de chance de succès
    setConnectionStatus(isSuccess ? "success" : "error");
    setIsTestingConnection(false);

    toast({
      title: isSuccess ? "Connexion réussie" : "Erreur de connexion",
      description: isSuccess 
        ? "La connexion à Amazon S3 fonctionne correctement." 
        : "Vérifiez vos identifiants et la configuration du bucket.",
      variant: isSuccess ? "default" : "destructive",
    });
  };

  const saveConfiguration = () => {
    toast({
      title: "Configuration sauvegardée",
      description: "Les paramètres ont été mis à jour avec succès.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configuration S3</h2>
        <p className="text-muted-foreground">
          Configurez les paramètres de connexion à Amazon S3 et les options d'upload.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration AWS S3 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Configuration AWS
              {connectionStatus === "success" && (
                <Badge variant="default" className="bg-green-500 text-white">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connecté
                </Badge>
              )}
              {connectionStatus === "error" && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Erreur
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Identifiants et paramètres de votre compte Amazon S3
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessKey">Clé d'accès AWS</Label>
                <Input
                  id="accessKey"
                  type="password"
                  placeholder="AKIA..."
                  value={config.awsAccessKey}
                  onChange={(e) => setConfig({...config, awsAccessKey: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretKey">Clé secrète AWS</Label>
                <Input
                  id="secretKey"
                  type="password"
                  placeholder="********"
                  value={config.awsSecretKey}
                  onChange={(e) => setConfig({...config, awsSecretKey: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Région AWS</Label>
                <Input
                  id="region"
                  placeholder="eu-west-1"
                  value={config.awsRegion}
                  onChange={(e) => setConfig({...config, awsRegion: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bucket">Nom du bucket</Label>
                <Input
                  id="bucket"
                  placeholder="mon-bucket-s3"
                  value={config.bucketName}
                  onChange={(e) => setConfig({...config, bucketName: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Options d'upload */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Options d'upload</CardTitle>
            <CardDescription>
              Paramètres par défaut pour les uploads de fichiers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Upload multipart</Label>
                <p className="text-sm text-muted-foreground">
                  Permet l'upload de fichiers très volumineux (500MB+ sans limite)
                </p>
              </div>
              <Switch
                checked={config.enableMultipart}
                onCheckedChange={(checked) => setConfig({...config, enableMultipart: checked})}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxSize">Limite de taille par fichier</Label>
                <Input
                  id="maxSize"
                  type="text"
                  value={config.maxFileSize}
                  readOnly
                  placeholder="Aucune limite configurée"
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Aucune limite de taille appliquée pour permettre les très gros fichiers
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowedTypes">Types de fichiers autorisés</Label>
                <Input
                  id="allowedTypes"
                  placeholder="pdf,jpg,png"
                  value={config.allowedTypes}
                  onChange={(e) => setConfig({...config, allowedTypes: e.target.value})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test et sauvegarde */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Test et sauvegarde</CardTitle>
            <CardDescription>
              Testez la connexion S3 et sauvegardez vos paramètres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testS3Connection} 
              disabled={isTestingConnection}
              className="w-full"
              variant="outline"
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Test en cours...
                </>
              ) : (
                "Tester la connexion S3"
              )}
            </Button>
            
            <Separator />
            
            <Button onClick={saveConfiguration} className="w-full">
              Sauvegarder la configuration
            </Button>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Vérifiez la connexion avant de sauvegarder</p>
              <p>• Les modifications prennent effet immédiatement</p>
              <p>• Les uploads en cours ne sont pas affectés</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}