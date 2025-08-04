
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { isToday, isThisWeek, isThisMonth, isThisYear } from "date-fns";

import PhotoGrid from "../components/photos/PhotoGrid";
import PhotoFilters from "../components/photos/PhotoFilters";
import PhotoActionsToolbar from "../components/photos/PhotoActionsToolbar";

export default function PhotosPage() {
  const [photos, setPhotos] = useState([]);
  const [filteredPhotos, setFilteredPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: "", date: "all", device: "all" });
  const [currentUser, setCurrentUser] = useState(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());

  useEffect(() => {
   // loadUserAndPhotos();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [photos, filters]);

  

  const applyFilters = () => {
    let filtered = [...photos];

    if (filters.search) {
      filtered = filtered.filter(photo =>
        photo.file_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        (photo.device_id && photo.device_id.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }

    if (filters.date !== "all") {
      filtered = filtered.filter(photo => {
        const photoDate = new Date(photo.taken_date);
        switch (filters.date) {
          case "today":
            return isToday(photoDate);
          case "week":
            return isThisWeek(photoDate);
          case "month":
            return isThisMonth(photoDate);
          case "year":
            return isThisYear(photoDate);
          default:
            return true;
        }
      });
    }

    if (filters.device !== "all") {
      filtered = filtered.filter(photo => photo.device_id === filters.device);
    }

    setFilteredPhotos(filtered);
  };
  
  const toggleSelectionMode = () => {
    setIsSelectionMode(prevMode => !prevMode);
    setSelectedPhotos(new Set());
  };

  const handlePhotoClick = (photo) => {
    if (isSelectionMode) {
      const newSelection = new Set(selectedPhotos);
      if (newSelection.has(photo.id)) {
        newSelection.delete(photo.id);
      } else {
        newSelection.add(photo.id);
      }
      setSelectedPhotos(newSelection);
    }
  };

  const handleSelectAll = () => {
    if (selectedPhotos.size === filteredPhotos.length && filteredPhotos.length > 0) {
      setSelectedPhotos(new Set());
    } else {
      const allPhotoIds = new Set(filteredPhotos.map(p => p.id));
      setSelectedPhotos(allPhotoIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

 

  const handleDownloadSelected = () => {
    if (selectedPhotos.size === 0) return;

    photos.forEach(photo => {
      if (selectedPhotos.has(photo.id)) {
        const link = document.createElement('a');
        link.href = photo.file_url;
        link.download = photo.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%)' }}>
      <div className="p-4 pt-6">
        <h2 className="text-xl font-semibold" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
          Photos
        </h2>
        <p className="text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
          {photos.length} photos {currentUser ? `from ${currentUser.phone_number}` : 'synced from your device'}
        </p>
      </div>

      {isSelectionMode ? (
        <PhotoActionsToolbar
          selectedCount={selectedPhotos.size}
          totalCount={filteredPhotos.length}
          onSelectAll={handleSelectAll}
          onDelete={handleDeleteSelected}
          onDownload={handleDownloadSelected}
          onCancel={handleClearSelection}
        />
      ) : (
        <PhotoFilters 
          onFilterChange={setFilters} 
          totalPhotos={photos.length}
          onToggleSelectionMode={toggleSelectionMode}
        />
      )}
      
      <div className="flex-1 overflow-y-auto">
        <PhotoGrid 
          photos={filteredPhotos} 
          isLoading={isLoading}
          isSelectionMode={isSelectionMode}
          selectedPhotos={selectedPhotos}
          onPhotoClick={handlePhotoClick}
        />
      </div>
    </div>
  );
}
