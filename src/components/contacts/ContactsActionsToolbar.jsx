import React from 'react';
import { Button } from "@/components/ui/button";
import { X, CheckSquare, Square, Download } from "lucide-react";

export default function ContactsActionsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onExportVCF,
  onExportCSV,
  onCancel
}) {
  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-10 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-10 w-10 rounded-full">
            <X className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-lg text-slate-800">
            {selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onSelectAll} className="rounded-full">
            {totalCount > 0 && selectedCount === totalCount ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
            {totalCount > 0 && selectedCount === totalCount ? 'Deselect All' : 'Select All'}
          </Button>
          <Button variant="outline" onClick={onExportVCF} disabled={selectedCount === 0} className="rounded-full">
            <Download className="w-4 h-4 mr-2" />
            Export VCF
          </Button>
          <Button variant="outline" onClick={onExportCSV} disabled={selectedCount === 0} className="rounded-full">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}