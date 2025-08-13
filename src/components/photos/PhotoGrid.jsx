import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Download, Calendar, Smartphone, X, ZoomIn, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PhotoGrid({ photos, isLoading, isSelectionMode, selectedPhotos, onPhotoClick }) {
  const [modalPhoto, setModalPhoto] = useState(null);

  const formatFileSize = (bytes) => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const handleClick = (photo) => {
    if (isSelectionMode) {
      onPhotoClick(photo);
    } else {
      setModalPhoto(photo);
    }
  };

  const safeFormatDate = (date, formatString) => {
      try {
          const d = new Date(date);
          if (isNaN(d.getTime())) return "Invalid date";
          return format(d, formatString);
      } catch (e) {
          return "Invalid date";
      }
  };

  const handleModalDownload = async (photo) => {
    try {
      const response = await fetch(photo.file_url);
      if (!response.ok) throw new Error('Network response was not ok.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', photo.file_name);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Download failed. Please try again."); // Simple error feedback
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
        {Array(20).fill(0).map((_, i) => (
          <div key={i} className="aspect-square bg-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-6">
        <AnimatePresence>
          {photos.map((photo, index) => {
            const isSelected = selectedPhotos.has(photo.photoId);
            return (
              <motion.div
                key={photo.photoId}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`group relative aspect-square bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer ${
                  isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
                onClick={() => handleClick(photo)}
              >
                <img
                  src={photo.file_url}
                  alt={photo.file_name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="absolute inset-0 bg-blue-500/30 flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-10 h-10 text-white drop-shadow-lg" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isSelected && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                )}

                <div className="absolute top-2 right-2">
                  <Badge 
                    variant={'default'} 
                    className="text-xs"
                  >
                    Synced
                  </Badge>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-xs font-medium">
                    {safeFormatDate(photo.taken_date, 'MMM d, yyyy')}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {photos.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Smartphone className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No Photos Found</h3>
          <p className="text-slate-500 text-center max-w-md">
            Photos will appear here once they're synced from your connected devices
          </p>
        </div>
      )}

      <AnimatePresence>
        {modalPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setModalPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl max-w-4xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="font-semibold text-slate-900">{modalPhoto.file_name}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {safeFormatDate(modalPhoto.taken_date, 'PPP')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Smartphone className="w-4 h-4" />
                      {modalPhoto.device_id || 'Unknown Device'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleModalDownload(modalPhoto)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setModalPhoto(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-4">
                <img
                  src={modalPhoto.file_url}
                  alt={modalPhoto.file_name}
                  className="max-w-full max-h-[60vh] mx-auto rounded-lg"
                />
                
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Dimensions</p>
                    <p className="font-medium">{modalPhoto.width} × {modalPhoto.height}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">File Size</p>
                    <p className="font-medium">{formatFileSize(modalPhoto.file_size)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Synced</p>
                    <p className="font-medium">{safeFormatDate(modalPhoto.syncedAt, 'PPp')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status</p>
                    <Badge variant={'default'}>
                      Synced
                    </Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}