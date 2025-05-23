// Enhanced UI Components
export { LoadingSpinner, LoadingOverlay } from './LoadingSpinner';
export { ErrorBoundary, useErrorHandler } from './ErrorBoundary';
export { SearchBar, type SearchBarProps, type SearchFilter } from './SearchBar';
export { PerformanceMonitor, type PerformanceMonitorProps } from './PerformanceMonitor';
export { GraphVisualization, type GraphVisualizationProps } from './GraphVisualization';
export { ProjectSidebar } from './ProjectSidebar';

// New Context Intelligence Components
export { ContextDashboard } from './ContextDashboard';
export { NaturalLanguageQuery } from './NaturalLanguageQuery';
export { SmartSuggestionsPanel } from './SmartSuggestionsPanel';

// Re-export other UI components if they exist
export * from './button';
export * from './card';
export * from './badge';
export * from './input';
export * from './select'; 