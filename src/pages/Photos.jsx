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
      // --- FIX 1: Use the correct unique ID 'photoId' for selection ---
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
      // --- FIX 2: Use the correct unique ID 'photoId' for select all ---
      const allPhotoIds = new Set(filteredPhotos.map(p => p.photoId));
      setSelectedPhotos(allPhotoIds);
    }
  };

  const handleClearSelection = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handleDownloadSelected = () => {
    if (selectedPhotos.size === 0) return;
    
    // --- FIX 3: Implement proper download logic ---
    photos.forEach(photo => {
      if (selectedPhotos.has(photo.photoId)) {
        // Create a temporary anchor element
        const link = document.createElement('a');
        link.href = photo.file_url; // The presigned URL
        link.download = photo.file_name; // The attribute that forces download
        
        // Append to the DOM, click it, and then remove it
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };
  
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