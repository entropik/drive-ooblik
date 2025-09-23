import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UploadZone from "@/components/FileUpload/UploadZone";
import { Package, Upload, Download, Clock, CheckCircle } from "lucide-react";

interface Order {
  id: string;
  number: string;
  date: string;
  status: 'pending' | 'processing' | 'completed';
  total: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: string;
  allowsUpload: boolean;
  uploadedFiles: UploadedFile[];
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  uploadDate: string;
  url: string;
}

const mockOrders: Order[] = [
  {
    id: '1',
    number: '#12345',
    date: '2024-01-15',
    status: 'completed',
    total: '299.00€',
    items: [
      {
        id: '1',
        name: 'Impression Poster A2',
        quantity: 2,
        price: '149.50€',
        allowsUpload: true,
        uploadedFiles: []
      }
    ]
  },
  {
    id: '2',
    number: '#12346',
    date: '2024-01-20',
    status: 'processing',
    total: '450.00€',
    items: [
      {
        id: '2',
        name: 'Impression Catalogue 20 pages',
        quantity: 1,
        price: '450.00€',
        allowsUpload: true,
        uploadedFiles: [
          {
            id: '1',
            name: 'catalogue-final.pdf',
            size: '2.5 MB',
            uploadDate: '2024-01-20',
            url: '#'
          }
        ]
      }
    ]
  }
];

const mockFiles: UploadedFile[] = [
  {
    id: '1',
    name: 'catalogue-final.pdf',
    size: '2.5 MB',
    uploadDate: '2024-01-20',
    url: '#'
  },
  {
    id: '2',
    name: 'logo-entreprise.ai',
    size: '850 KB',
    uploadDate: '2024-01-18',
    url: '#'
  },
  {
    id: '3',
    name: 'photos-produits.zip',
    size: '15.2 MB',
    uploadDate: '2024-01-15',
    url: '#'
  }
];

export default function CustomerArea() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/20 text-amber-700 border-amber-500/30';
      case 'processing':
        return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30';
      default:
        return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'processing':
        return 'En cours';
      case 'completed':
        return 'Terminée';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-slate-800">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Espace Client</h1>
          <p className="text-muted-foreground">Gérez vos commandes et fichiers</p>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Mes Commandes
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Mes Fichiers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            {!selectedOrder ? (
              <div className="grid gap-4">
                <h2 className="text-2xl font-semibold text-foreground">Mes Commandes</h2>
                {mockOrders.map((order) => (
                  <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedOrder(order)}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{order.number}</h3>
                          <p className="text-muted-foreground">Commandé le {new Date(order.date).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">{order.total}</p>
                          <Badge className={getStatusColor(order.status)}>
                            {getStatusLabel(order.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-2 border-t">
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">Quantité: {item.quantity}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.price}</span>
                              {item.allowsUpload && (
                                <Upload className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-6">
                  <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                    ← Retour aux commandes
                  </Button>
                  <h2 className="text-2xl font-semibold">Commande {selectedOrder.number}</h2>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Détails de la commande</CardTitle>
                    <CardDescription>
                      Commandé le {new Date(selectedOrder.date).toLocaleDateString('fr-FR')} - Total: {selectedOrder.total}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-medium text-lg">{item.name}</h3>
                            <p className="text-muted-foreground">Quantité: {item.quantity} - {item.price}</p>
                          </div>
                          {item.uploadedFiles.length > 0 && (
                            <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Fichiers uploadés
                            </Badge>
                          )}
                        </div>

                        {item.allowsUpload && (
                          <div className="space-y-4">
                            <h4 className="font-medium flex items-center gap-2">
                              <Upload className="h-4 w-4" />
                              Upload de fichiers
                            </h4>
                            
                            {item.uploadedFiles.length > 0 && (
                              <div className="bg-muted/50 rounded-lg p-4">
                                <h5 className="font-medium mb-2">Fichiers uploadés:</h5>
                                {item.uploadedFiles.map((file) => (
                                  <div key={file.id} className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                                        <Download className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-sm text-muted-foreground">{file.size} - {file.uploadDate}</p>
                                      </div>
                                    </div>
                                    <Button size="sm" variant="outline">
                                      <Download className="h-4 w-4 mr-1" />
                                      Télécharger
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <UploadZone />
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="files" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mes Fichiers</CardTitle>
                <CardDescription>
                  Tous vos fichiers uploadés et réutilisables pour de nouvelles commandes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {mockFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Download className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {file.size} - Uploadé le {file.uploadDate}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline">
                          Réutiliser
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}