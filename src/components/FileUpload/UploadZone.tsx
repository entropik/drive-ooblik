import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Image, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export default function UploadZone() {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: "pending" as const,
    }));
    
    setFiles((prev) => [...prev, ...newFiles]);

    // Simuler l'upload
    newFiles.forEach((uploadFile) => {
      simulateUpload(uploadFile.id);
    });
  }, []);

  const simulateUpload = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: "uploading" } : f))
    );

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, progress: Math.min(progress, 100) } : f
        )
      );

      if (progress >= 100) {
        clearInterval(interval);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "completed", progress: 100 } : f
          )
        );
      }
    }, 200);
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.pdf'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 1024 * 1024 * 1024, // 1GB
  });

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-8 w-8 text-primary" />;
    }
    return <FileText className="h-8 w-8 text-primary" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <Card
        {...getRootProps()}
        className={cn(
          "p-8 border-2 border-dashed cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-upload-zone"
            : "border-upload-zone-border hover:border-primary hover:bg-upload-zone"
        )}
      >
        <input {...getInputProps()} />
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {isDragActive ? "Déposez vos fichiers ici" : "Glissez-déposez vos fichiers"}
          </h3>
          <p className="text-muted-foreground mb-4">
            ou <span className="text-primary font-medium">cliquez pour parcourir</span>
          </p>
          <div className="text-sm text-muted-foreground">
            Formats supportés: PDF, JPG, PNG • Taille max: 1GB par fichier
          </div>
        </div>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Fichiers en cours d'upload ({files.length})</h3>
          {files.map((uploadFile) => (
            <Card key={uploadFile.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {getFileIcon(uploadFile.file)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadFile.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(uploadFile.file.size)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {uploadFile.status === "completed" && (
                    <CheckCircle className="h-5 w-5 text-success" />
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadFile.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {uploadFile.status === "uploading" && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Upload en cours...</span>
                    <span className="text-sm font-medium">{Math.round(uploadFile.progress)}%</span>
                  </div>
                  <Progress value={uploadFile.progress} className="h-2" />
                </div>
              )}
              
              {uploadFile.status === "completed" && (
                <div className="mt-2 text-sm text-success">
                  ✓ Fichier uploadé avec succès
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}