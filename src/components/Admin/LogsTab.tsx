import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-15T10:35:22Z",
    level: "success",
    action: "file_upload",
    message: "Fichier brochure-marketing.pdf uploadé avec succès",
    user: "client@exemple.com",
    details: "Taille: 2.4MB, Bucket: mon-bucket-s3"
  },
  {
    id: "2",
    timestamp: "2024-01-15T10:30:15Z",
    level: "info",
    action: "s3_connection",
    message: "Test de connexion S3 initié",
    user: "admin@site.com"
  },
  {
    id: "3",
    timestamp: "2024-01-15T10:25:08Z",
    level: "error",
    action: "file_upload",
    message: "Échec de l'upload: fichier trop volumineux",
    user: "user@test.fr",
    details: "Taille: 2.1GB, Limite: 1GB"
  },
  {
    id: "4",
    timestamp: "2024-01-15T09:45:33Z",
    level: "warning",
    action: "config_change",
    message: "Modification de la configuration S3",
    user: "admin@site.com",
    details: "Changement de région: us-east-1 → eu-west-1"
  },
  {
    id: "5",
    timestamp: "2024-01-15T09:20:17Z",
    level: "success",
    action: "s3_connection",
    message: "Connexion S3 établie avec succès",
    user: "admin@site.com"
  },
  {
    id: "6",
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
    };
    return actions[action] || action;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user && log.user.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const exportLogs = () => {
    const csvContent = [
      "Timestamp,Level,Action,Message,User,Details",
      ...filteredLogs.map(log => 
        `"${log.timestamp}","${log.level}","${log.action}","${log.message}","${log.user || ''}","${log.details || ''}"`
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.level === 'success').length}</p>
                <p className="text-sm text-muted-foreground">Succès</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.level === 'error').length}</p>
                <p className="text-sm text-muted-foreground">Erreurs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.level === 'warning').length}</p>
                <p className="text-sm text-muted-foreground">Avertissements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-info" />
              <div>
                <p className="text-2xl font-bold">{logs.length}</p>
                <p className="text-sm text-muted-foreground">Total événements</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Recherche et filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans les logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrer par niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                <SelectItem value="success">Succès</SelectItem>
                <SelectItem value="info">Information</SelectItem>
                <SelectItem value="warning">Avertissement</SelectItem>
                <SelectItem value="error">Erreur</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Purger anciens
            </Button>
          </div>
        </CardContent>
      </Card>

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