import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { isToday, isThisWeek, isThisMonth, isThisYear } from "date-fns";
import { api } from '@/lib/api'; 

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
    loadPhotos();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [photos, filters]);

  const loadPhotos = async () => {
    setIsLoading(true);
    try {
        const fetchedPhotos = await api.get('/photos');
        fetchedPhotos.sort((a, b) => new Date(b.taken_date) - new Date(a.taken_date));
        setPhotos(fetchedPhotos);
    } catch (error) {
        console.error("Failed to load photos:", error);
    } finally {
        setIsLoading(false);
    }
  };

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
          case "today": return isToday(photoDate);
          case "week": return isThisWeek(photoDate);
          case "month": return isThisMonth(photoDate);
          case "year": return isThisYear(photoDate);
          default: return true;
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
      if (newSelection.has(photo.photoId)) {
        newSelection.delete(photo.photoId);
      } else {
        newSelection.add(photo.photoId);
      }
      setSelectedPhotos(newSelection);
    }
  };

  const handleSelectAll = () => {
    if (selectedPhotos.size === filteredPhotos.length && filteredPhotos.length > 0) {
      setSelectedPhotos(new Set());
    } else {
      const allPhotoIds = new Set(filteredPhotos.map(p => p.photoId));
      setSelectedPhotos(allPhotoIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  // --- START OF FIX: REPLACED DOWNLOAD LOGIC ---
  const handleDownloadSelected = async () => {
    if (selectedPhotos.size === 0) return;

    for (const photoId of selectedPhotos) {
      const photo = photos.find(p => p.photoId === photoId);
      if (!photo) continue;

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
        console.error(`Download failed for ${photo.file_name}:`, error);
        // Optionally, show an error toast to the user here.
      }
    }
  };
  // --- END OF FIX ---
  
  const handleDeleteSelected = () => {
    console.warn("Delete functionality is not implemented yet.");
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: 'linear-gradient(to bottom, #f0f9ff, #ffffff)' }}>
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
        <div className="p-6 border-b" style={{ background: 'rgb(var(--md-sys-color-surface))', borderColor: 'rgb(var(--md-sys-color-outline-variant))' }}>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
                Photos
              </h2>
              <p className="text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                {photos.length} photos synced from your device
              </p>
            </div>
            <PhotoFilters 
              onFilterChange={setFilters} 
              onToggleSelectionMode={toggleSelectionMode}
            />
          </div>
        </div>
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