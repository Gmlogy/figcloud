import React from 'react';
import { Button } from "@/components/ui/button";
import { X, Trash2, Download, CheckSquare, Square } from "lucide-react";

export default function PhotoActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDownload,
  onDelete,
  onCancel
}) {
  return (
    <div className="p-4 border-b flex items-center justify-between" style={{
      background: 'rgb(var(--md-sys-color-surface-container-high))',
      borderColor: 'rgb(var(--md-sys-color-outline-variant))'
    }}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-10 w-10">
          <X className="w-5 h-5" />
        </Button>
        <span className="font-semibold text-lg" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
          {selectedCount} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onSelectAll}>
          {totalCount > 0 && selectedCount === totalCount ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
          {totalCount > 0 && selectedCount === totalCount ? 'Deselect All' : 'Select All'}
        </Button>
        <Button variant="outline" onClick={onDownload} disabled={selectedCount === 0}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={selectedCount === 0}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
}