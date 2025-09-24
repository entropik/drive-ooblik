import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Download, 
  Trash2,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  Calendar
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  action: string;
  message: string;
  user?: string;
  details?: string;
  email_recipient?: string;
  email_subject?: string;
}

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-15T11:15:33Z",
    level: "success",
    action: "email_sent",
    message: "Email de confirmation envoyé avec succès",
    user: "admin@site.com",
    email_recipient: "client@exemple.com",
    email_subject: "Confirmation de réception de votre fichier",
    details: "Serveur SMTP: smtp.gmail.com:587, Temps: 1.2s"
  },
  {
    id: "2",
    timestamp: "2024-01-15T10:45:22Z",
    level: "error",
    action: "email_failed",
    message: "Échec de l'envoi d'email: connexion SMTP impossible",
    user: "admin@site.com",
    email_recipient: "invalide@domaine.com",
    email_subject: "Notification d'upload",
    details: "Erreur: Connection timeout après 30s"
  },
  {
    id: "3",
    timestamp: "2024-01-15T10:35:22Z",
    level: "success",
    action: "file_upload",
    message: "Fichier brochure-marketing.pdf uploadé avec succès",
    user: "client@exemple.com",
    details: "Taille: 2.4MB, Bucket: mon-bucket-s3"
  },
  {
    id: "4",
    timestamp: "2024-01-15T10:30:15Z",
    level: "info",
    action: "smtp_test",
    message: "Test de connexion SMTP initié",
    user: "admin@site.com",
    details: "Serveur: smtp.gmail.com:587"
  },
  {
    id: "5",
    timestamp: "2024-01-15T10:25:08Z",
    level: "error",
    action: "file_upload",
    message: "Échec de l'upload: fichier trop volumineux",
    user: "user@test.fr",
    details: "Taille: 2.1GB, Limite: 1GB"
  },
  {
    id: "6",
    timestamp: "2024-01-15T09:55:17Z",
    level: "warning",
    action: "email_bounce",
    message: "Email retourné: adresse invalide",
    user: "system",
    email_recipient: "ancien@client.fr",
    email_subject: "Lien de téléchargement",
    details: "Bounce reason: Mailbox does not exist"
  },
  {
    id: "7",
    timestamp: "2024-01-15T09:45:33Z",
    level: "warning",
    action: "config_change",
    message: "Modification de la configuration S3",
    user: "admin@site.com",
    details: "Changement de région: us-east-1 → eu-west-1"
  },
  {
    id: "8",
    timestamp: "2024-01-15T09:30:12Z",
    level: "success",
    action: "email_sent",
    message: "Email de notification envoyé",
    user: "system",
    email_recipient: "admin@site.com",
    email_subject: "Rapport quotidien d'activité",
    details: "Auto-généré, 15 fichiers traités aujourd'hui"
  },
  {
    id: "9",
    timestamp: "2024-01-15T09:20:17Z",
    level: "success",
    action: "s3_connection",
    message: "Connexion S3 établie avec succès",
    user: "admin@site.com"
  },
  {
    id: "10",
    timestamp: "2024-01-14T16:22:45Z",
    level: "info",
    action: "file_delete",
    message: "Fichier supprimé par l'administrateur",
    user: "admin@site.com",
    details: "Fichier: old-document.pdf"
  }
];

export default function LogsTab() {
  const [logs] = useState<LogEntry[]>(mockLogs);
  const [searchTerm, setSearchTerm] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "success":
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3 mr-1" />
            Succès
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erreur
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="default" className="bg-warning text-warning-foreground">
            <AlertCircle className="h-3 w-3 mr-1" />
            Attention
          </Badge>
        );
      case "info":
        return (
          <Badge variant="secondary">
            <Info className="h-3 w-3 mr-1" />
            Info
          </Badge>
        );
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const getActionLabel = (action: string) => {
    const actions: Record<string, string> = {
      file_upload: "Upload fichier",
      file_delete: "Suppression fichier",
      s3_connection: "Connexion S3",
      config_change: "Config modifiée",
      email_sent: "Email envoyé",
      email_failed: "Email échoué",
      email_bounce: "Email retourné",
      smtp_test: "Test SMTP",
    };
    return actions[action] || action;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user && log.user.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.email_recipient && log.email_recipient.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.email_subject && log.email_subject.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const exportLogs = () => {
    const csvContent = [
      "Timestamp,Level,Action,Message,User,Email_Recipient,Email_Subject,Details",
      ...filteredLogs.map(log => 
        `"${log.timestamp}","${log.level}","${log.action}","${log.message}","${log.user || ''}","${log.email_recipient || ''}","${log.email_subject || ''}","${log.details || ''}"`
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Journal d'activité</h2>
          <p className="text-muted-foreground">
            Suivi des actions et événements du système.
          </p>
        </div>
        
        <Button onClick={exportLogs} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter CSV
        </Button>
      </div>

      {/* Statistiques des logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Statistiques des événements</CardTitle>
            <CardDescription>Répartition par niveau de log</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{logs.filter(l => l.level === 'success').length}</p>
                  <p className="text-sm text-muted-foreground">Succès</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{logs.filter(l => l.level === 'error').length}</p>
                  <p className="text-sm text-muted-foreground">Erreurs</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{logs.filter(l => l.level === 'warning').length}</p>
                  <p className="text-sm text-muted-foreground">Avertissements</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{logs.length}</p>
                  <p className="text-sm text-muted-foreground">Total événements</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recherche et filtres</CardTitle>
            <CardDescription>Filtrez et recherchez dans les logs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Recherche dans les logs</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Filtrer par niveau</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les niveaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les niveaux</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="info">Information</SelectItem>
                  <SelectItem value="warning">Avertissement</SelectItem>
                  <SelectItem value="error">Erreur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2 text-xs text-muted-foreground">
              <p>{filteredLogs.length} événement(s) trouvé(s)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>Exportation et maintenance des logs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={exportLogs} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Exporter en CSV
            </Button>
            
            <Button variant="outline" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Purger les anciens logs
            </Button>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• L'export inclut tous les logs filtrés</p>
              <p>• La purge supprime les logs &gt; 30 jours</p>
              <p>• Les logs critiques sont conservés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table des logs */}
      <Card>
        <CardHeader>
          <CardTitle>Événements récents ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Heure</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    {formatDate(log.timestamp)}
                  </TableCell>
                  <TableCell>{getLevelBadge(log.level)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="line-clamp-2">{log.message}</span>
                  </TableCell>
                  <TableCell>
                    {log.user && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {log.user}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {log.email_recipient && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">À: {log.email_recipient}</div>
                        {log.email_subject && (
                          <div className="text-xs font-medium line-clamp-1" title={log.email_subject}>
                            {log.email_subject}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {log.details && (
                      <span className="text-sm text-muted-foreground line-clamp-1" title={log.details}>
                        {log.details}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}