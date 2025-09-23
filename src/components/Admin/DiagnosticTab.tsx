import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Server,
  Database,
  Globe,
  Zap,
  Shield,
  HardDrive
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiagnosticItem {
  id: string;
  name: string;
  description: string;
  status: "success" | "error" | "warning" | "pending";
  icon: React.ElementType;
  details?: string;
  value?: string;
}

export default function DiagnosticTab() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([
    {
      id: "s3-connection",
      name: "Connexion Amazon S3",
      description: "Test de connectivité vers le service S3",
      status: "success",
      icon: Database,
      details: "Région: eu-west-1 • Latence: 45ms",
      value: "Connecté"
    },
    {
      id: "bucket-access",
      name: "Accès au bucket",
      description: "Vérification des permissions de lecture/écriture",
      status: "success", 
      icon: HardDrive,
      details: "Bucket: mon-bucket-s3 • Permissions: R/W",
      value: "Autorisé"
    },
    {
      id: "upload-endpoint",
      name: "Endpoints d'upload",
      description: "Disponibilité des URLs de signature",
      status: "warning",
      icon: Globe,
      details: "Endpoint principal OK • Backup lent",
      value: "Partiellement OK"
    },
    {
      id: "multipart-support",
      name: "Upload multipart",
      description: "Support des fichiers volumineux",
      status: "success",
      icon: Zap,
      details: "Chunk size: 10MB • Max: 10TB",
      value: "Supporté"
    },
    {
      id: "ssl-certificate",
      name: "Certificat SSL",
      description: "Sécurité des communications",
      status: "success",
      icon: Shield,
      details: "Expire le 15/06/2025",
      value: "Valide"
    },
    {
      id: "server-resources",
      name: "Ressources serveur",
      description: "CPU, mémoire et espace disque",
      status: "error",
      icon: Server,
      details: "RAM: 85% utilisée • Disque: 92% plein",
      value: "Critique"
    }
  ]);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setProgress(0);

    // Simuler le diagnostic
    const steps = diagnostics.length;
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setProgress(((i + 1) / steps) * 100);
      
      // Simuler des changements de statut aléatoires
      setDiagnostics(prev => prev.map((item, index) => {
        if (index === i) {
          const statuses = ["success", "warning", "error"];
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          return { ...item, status: randomStatus as any };
        }
        return item;
      }));
    }

    setIsRunning(false);
    toast({
      title: "Diagnostic terminé",
      description: "Vérifiez les résultats ci-dessous.",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "error":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case "pending":
        return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-success text-success-foreground">OK</Badge>;
      case "error":
        return <Badge variant="destructive">Erreur</Badge>;
      case "warning":
        return <Badge variant="default" className="bg-warning text-warning-foreground">Attention</Badge>;
      case "pending":
        return <Badge variant="secondary">En cours...</Badge>;
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const successCount = diagnostics.filter(d => d.status === "success").length;
  const errorCount = diagnostics.filter(d => d.status === "error").length;
  const warningCount = diagnostics.filter(d => d.status === "warning").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Diagnostic système</h2>
          <p className="text-muted-foreground">
            Vérification de l'état du système et des connexions.
          </p>
        </div>
        
        <Button 
          onClick={runDiagnostic} 
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Diagnostic en cours...
            </>
          ) : (
            "Lancer le diagnostic"
          )}
        </Button>
      </div>

      {/* Barre de progression */}
      {isRunning && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Diagnostic en cours...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résumé des résultats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{successCount}</p>
                <p className="text-sm text-muted-foreground">Tests réussis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{warningCount}</p>
                <p className="text-sm text-muted-foreground">Avertissements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-sm text-muted-foreground">Erreurs critiques</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détails des diagnostics */}
      <div className="grid gap-4">
        {diagnostics.map((diagnostic) => {
          const Icon = diagnostic.icon;
          return (
            <Card key={diagnostic.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Icon className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                      <h3 className="font-semibold">{diagnostic.name}</h3>
                      <p className="text-sm text-muted-foreground">{diagnostic.description}</p>
                      {diagnostic.details && (
                        <p className="text-xs text-muted-foreground mt-1">{diagnostic.details}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <p className="font-medium">{diagnostic.value}</p>
                      {getStatusBadge(diagnostic.status)}
                    </div>
                    {getStatusIcon(diagnostic.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recommandations */}
      {(errorCount > 0 || warningCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              <span>Recommandations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {errorCount > 0 && (
                <div className="flex items-start space-x-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Erreurs critiques détectées</p>
                    <p className="text-muted-foreground">
                      Les ressources serveur sont insuffisantes. Contactez votre hébergeur.
                    </p>
                  </div>
                </div>
              )}
              
              {warningCount > 0 && (
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-warning">Optimisations possibles</p>
                    <p className="text-muted-foreground">
                      Configurez un endpoint de secours pour améliorer la fiabilité des uploads.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}