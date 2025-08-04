import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, Search, CheckSquare } from "lucide-react";

export default function PhotoFilters({ onFilterChange, totalPhotos, onToggleSelectionMode }) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("all");
  const [deviceFilter, setDeviceFilter] = React.useState("all");

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    onFilterChange({ search: query, date: dateFilter, device: deviceFilter });
  };

  return (
    <div className="p-6 border-b" style={{ 
      background: 'rgb(var(--md-sys-color-surface))',
      borderColor: 'rgb(var(--md-sys-color-outline-variant))'
    }}>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'rgb(var(--md-sys-color-on-surface))' }}>
            Photos
          </h2>
          <p className="text-sm" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }}>
            {totalPhotos} photos synced from your devices
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'rgb(var(--md-sys-color-on-surface-variant))' }} />
            <Input
              placeholder="Search photos..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 w-full sm:w-64"
            />
          </div>

          <Select value={dateFilter} onValueChange={(value) => {
            setDateFilter(value);
            onFilterChange({ search: searchQuery, date: value, device: deviceFilter });
          }}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={onToggleSelectionMode}>
            <CheckSquare className="w-4 h-4 mr-2"/>
            Select
          </Button>
        </div>
      </div>
    </div>
  );
}