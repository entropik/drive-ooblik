import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Download, 
  Trash2, 
  FileText, 
  Image, 
  Calendar,
  User,
  HardDrive
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  customerEmail: string;
  orderId: string;
  status: "completed" | "processing" | "failed";
  s3_key?: string;
  space_name?: string;
}

export default function FilesTab() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      
      // Récupérer les fichiers avec les informations des espaces et email privé
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select(`
          id,
          original_name,
          mime_type,
          file_size,
          created_at,
          upload_status,
          s3_key,
          spaces (
            id,
            space_name,
            spaces_private (
              email
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filesError) {
        console.error('Erreur récupération fichiers:', filesError);
        return;
      }

      const formattedFiles: FileItem[] = (filesData || []).map(file => ({
        id: file.id,
        name: file.original_name,
        type: file.mime_type || 'unknown',
        size: file.file_size,
        uploadedAt: file.created_at,
        customerEmail: file.spaces?.spaces_private?.[0]?.email || 'N/A',
        orderId: `#${file.id.slice(0, 8)}`,
        status: file.upload_status === 'completed' ? 'completed' : 
                file.upload_status === 'pending' ? 'processing' : 'failed',
        s3_key: file.s3_key,
        space_name: file.spaces?.space_name || 'N/A'
      }));

      setFiles(formattedFiles);
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
    } finally {
      setLoading(false);
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-4 w-4 text-primary" />;
    }
    return <FileText className="h-4 w-4 text-primary" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-success text-success-foreground">Complété</Badge>;
      case "processing":
        return <Badge variant="secondary">En cours</Badge>;
      case "failed":
        return <Badge variant="destructive">Échec</Badge>;
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.orderId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || file.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">Gestion des fichiers</h2>
            <p className="text-muted-foreground">
              Chargement des fichiers...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Gestion des fichiers</h2>
          <p className="text-muted-foreground">
            Vue d'ensemble des fichiers uploadés par vos clients.
          </p>
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <div className="flex items-center space-x-1">
            <HardDrive className="h-4 w-4" />
            <span>{formatFileSize(totalSize)} utilisés</span>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Statistiques générales</CardTitle>
            <CardDescription>Vue d'ensemble des fichiers uploadés</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{files.length}</p>
                  <p className="text-sm text-muted-foreground">Fichiers total</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{formatFileSize(totalSize)}</p>
                  <p className="text-sm text-muted-foreground">Espace utilisé</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{new Set(files.map(f => f.customerEmail)).size}</p>
                  <p className="text-sm text-muted-foreground">Clients actifs</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recherche et filtres</CardTitle>
            <CardDescription>Trouvez rapidement les fichiers recherchés</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Recherche globale</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nom, email ou commande..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Filtrer par statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="completed">Complétés</SelectItem>
                  <SelectItem value="processing">En cours</SelectItem>
                  <SelectItem value="failed">Échec</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2 text-xs text-muted-foreground">
              <p>{filteredFiles.length} fichier(s) trouvé(s)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Analyse rapide</CardTitle>
            <CardDescription>Répartition par statut et activité récente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Complétés</span>
                <span className="text-sm font-medium">{files.filter(f => f.status === 'completed').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">En cours</span>
                <span className="text-sm font-medium">{files.filter(f => f.status === 'processing').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Échoués</span>
                <span className="text-sm font-medium">{files.filter(f => f.status === 'failed').length}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Calendar className="h-6 w-6 text-orange-500" />
              <div>
                <p className="text-lg font-bold">7</p>
                <p className="text-xs text-muted-foreground">Derniers jours d'activité</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table des fichiers */}
      <Card>
        <CardHeader>
          <CardTitle>Fichiers ({filteredFiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fichier</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Commande</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getFileIcon(file.type)}
                      <span className="font-medium">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{file.customerEmail}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{file.orderId}</Badge>
                  </TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>{formatDate(file.uploadedAt)}</TableCell>
                  <TableCell>{getStatusBadge(file.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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