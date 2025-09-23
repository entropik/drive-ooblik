import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, File, CheckCircle, XCircle, RefreshCw, Trash2 } from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  uploadId?: string;
  s3Key?: string;
}

interface FileUploadZoneProps {
  magicToken: string;
  onComplete: (files: UploadFile[]) => void;
}

const FileUploadZone = ({ magicToken, onComplete }: FileUploadZoneProps) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending' as const
    }));

    setFiles(prev => {
      const updatedFiles = [...prev, ...newFiles];
      
      // Démarrer l'upload pour chaque nouveau fichier
      newFiles.forEach(uploadFile => {
        setTimeout(() => simulateUpload(uploadFile.id, updatedFiles), 0);
      });
      
      return updatedFiles;
    });
  }, []);

  const simulateUpload = async (fileId: string, currentFiles?: UploadFile[]) => {
    // Utiliser les fichiers passés en paramètre ou l'état actuel
    const filesToUse = currentFiles || files;
    const fileIndex = filesToUse.findIndex(f => f.id === fileId);
    if (fileIndex === -1) {
      console.error('Fichier non trouvé:', fileId);
      return;
    }

    const file = filesToUse[fileIndex];
    
    try {
      // Étape 1: Initialiser l'upload
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'uploading' } : f
      ));

      const initResponse = await fetch(`https://khygjfhrmnwtigqtdmgm.supabase.co/functions/v1/upload-init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeWdqZmhybW53dGlncXRkbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MzUwNDUsImV4cCI6MjA3NDIxMTA0NX0.iTtQEbCcScU_da3Micct9Y13_Obl8KVBa8M7FkHzIww',
          'x-magic-token': magicToken
        },
        body: JSON.stringify({
          filename: file.file.name,
          file_size: file.file.size,
          mime_type: file.file.type
        })
      });

      const initData = await initResponse.json();
      
      if (!initResponse.ok) {
        throw new Error(initData.error || 'Erreur lors de l\'initialisation');
      }

      // Mise à jour avec les données d'upload
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          uploadId: initData.upload_id,
          s3Key: initData.s3_key 
        } : f
      ));

      // Simulation de la progression d'upload
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, progress } : f
        ));
      }

      // Marquer comme complété
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'completed', progress: 100 } : f
      ));

      toast.success(`${file.file.name} uploadé avec succès`);

    } catch (error) {
      console.error('Erreur upload:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        } : f
      ));
      toast.error(`Erreur upload ${file.file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const retryUpload = (fileId: string) => {
    setFiles(prev => {
      const updatedFiles = prev.map(f => 
        f.id === fileId ? { ...f, status: 'pending' as const, progress: 0, error: undefined } : f
      );
      
      setTimeout(() => simulateUpload(fileId, updatedFiles), 0);
      
      return updatedFiles;
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    multiple: true,
    // Aucune limite de taille pour permettre les gros fichiers (500MB+)
  });

  const completedFiles = files.filter(f => f.status === 'completed');
  const hasFiles = files.length > 0;
  const allCompleted = hasFiles && files.every(f => f.status === 'completed');

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Espace de transfert
          </h1>
          <p className="text-muted-foreground">
            Glissez-déposez vos fichiers ou cliquez pour les sélectionner
          </p>
        </div>

        <Card className={`border-2 border-dashed transition-colors ${
          isDragActive || isDragging 
            ? 'border-primary bg-upload-zone' 
            : 'border-upload-zone-border'
        }`}>
          <div {...getRootProps()} className="cursor-pointer">
            <input {...getInputProps()} />
            <CardContent className="py-12 text-center">
              <Upload className={`h-12 w-12 mx-auto mb-4 ${
                isDragActive ? 'text-primary' : 'text-muted-foreground'
              }`} />
              <CardTitle className="mb-2">
                {isDragActive 
                  ? 'Déposez vos fichiers ici' 
                  : 'Cliquez ou glissez vos fichiers'
                }
              </CardTitle>
              <CardDescription>
                Formats acceptés : JPG, PNG, PDF, DOC, ZIP... (aucune limite de taille)
              </CardDescription>
            </CardContent>
          </div>
        </Card>

        {hasFiles && (
          <Card>
            <CardHeader>
              <CardTitle>Fichiers ({files.length})</CardTitle>
              <CardDescription>
                État des transferts en cours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {files.map((file) => (
                <div key={file.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {file.status === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-success" />
                    )}
                    {file.status === 'error' && (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    {file.status === 'uploading' && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    )}
                    {file.status === 'pending' && (
                      <File className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    
                    {file.status === 'uploading' && (
                      <Progress value={file.progress} className="h-2" />
                    )}
                    
                    {file.error && (
                      <p className="text-xs text-destructive mt-1">
                        {file.error}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {file.status === 'error' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryUpload(file.id)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {allCompleted && (
          <Card className="border-success">
            <CardContent className="py-6 text-center">
              <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
              <CardTitle className="text-success mb-2">
                Transfert terminé !
              </CardTitle>
              <CardDescription className="mb-4">
                {completedFiles.length} fichier(s) uploadé(s) avec succès
              </CardDescription>
              <p className="text-sm text-muted-foreground">
                Référence : <code className="font-mono">REF-{Date.now().toString(36).toUpperCase()}</code>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FileUploadZone;