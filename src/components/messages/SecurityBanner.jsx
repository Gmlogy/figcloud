import React from "react";
import { Shield, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SecurityBanner({ currentUser }) {
  return (
    <div className="px-4 py-3 border-b" style={{ 
      background: 'linear-gradient(135deg, rgb(var(--md-sys-color-primary-container)), rgb(var(--md-sys-color-surface-container-lowest)))',
      borderColor: 'rgb(var(--md-sys-color-outline-variant))'
    }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Shield className="w-5 h-5 flex-shrink-0" style={{ color: 'rgb(var(--md-sys-color-primary))' }} />
          <div className="flex-1 min-w-0">
             <p className="text-sm font-medium truncate" style={{ color: 'rgb(var(--md-sys-color-on-primary-container))' }}>
                Secure Connection
             </p>
             {currentUser && (
                <p className="text-xs truncate" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
                   {currentUser.phone_number}
                </p>
             )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'rgb(var(--md-sys-color-primary))' }}></div>
          <Badge variant="outline" className="text-xs material-chip">
            <Smartphone className="w-3 h-3 mr-1" />
            Synced
          </Badge>
        </div>
      </div>
    </div>
  );
}