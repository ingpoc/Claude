"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Badge } from './badge';
import { cn } from '../../lib/utils';

export interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  debounceMs?: number;
  className?: string;
  showFilters?: boolean;
  filters?: SearchFilter[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (filters: Record<string, string>) => void;
  searchResults?: number;
  isLoading?: boolean;
}

export interface SearchFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export function SearchBar({
  placeholder = "Search...",
  value,
  onChange,
  onSearch,
  debounceMs = 300,
  className,
  showFilters = false,
  filters = [],
  activeFilters = {},
  onFilterChange,
  searchResults,
  isLoading = false
}: SearchBarProps) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs]);

  // Trigger search when debounced value changes
  useEffect(() => {
    if (onSearch) {
      onSearch(debouncedValue);
    }
  }, [debouncedValue, onSearch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      
      // Escape to clear search
      if (event.key === 'Escape' && inputRef.current === document.activeElement) {
        onChange('');
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onChange]);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleFilterChange = (filterKey: string, filterValue: string) => {
    if (!onFilterChange) return;
    
    const newFilters = { ...activeFilters };
    if (filterValue === '') {
      delete newFilters[filterKey];
    } else {
      newFilters[filterKey] = filterValue;
    }
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    if (onFilterChange) {
      onFilterChange({});
    }
  };

  const activeFilterCount = Object.keys(activeFilters).length;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative flex items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-muted border-t-foreground rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Filter Toggle */}
        {showFilters && filters.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={cn(
              "relative",
              activeFilterCount > 0 && "border-primary"
            )}
          >
            <Filter className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <Badge 
                variant="secondary" 
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Results Count */}
      {typeof searchResults === 'number' && value && (
        <div className="text-sm text-muted-foreground">
          {searchResults} result{searchResults !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {Object.entries(activeFilters).map(([key, value]) => {
            const filter = filters.find(f => f.key === key);
            const option = filter?.options.find(o => o.value === value);
            return (
              <Badge key={key} variant="secondary" className="gap-1">
                {filter?.label}: {option?.label || value}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilterChange(key, '')}
                  className="h-auto p-0 w-3 h-3 ml-1"
                >
                  <X className="w-2 h-2" />
                </Button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs h-6"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Filter Dropdown */}
      {showFilterDropdown && showFilters && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilterDropdown(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filters.map((filter) => (
              <div key={filter.key} className="space-y-2">
                <label className="text-sm font-medium">{filter.label}</label>
                <Select
                  value={activeFilters[filter.key] || ''}
                  onValueChange={(value) => handleFilterChange(filter.key, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcut Hint */}
      <div className="text-xs text-muted-foreground">
        Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-muted rounded text-xs">K</kbd> to focus search
      </div>
    </div>
  );
} 