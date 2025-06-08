import React, { useState, useEffect } from 'react';
import { X, Link2, ArrowRight, Info, Clock, Hash, FilePlus, Edit, Trash2, Save, XCircle } from 'lucide-react';
import type { Entity, Relationship, Observation } from '../lib/services';
import { RelationshipTypes } from '../lib/constants'; // Reverted path
import { useProject } from '../context/ProjectContext'; // Reverted path
import { cn } from "../lib/utils"; // Reverted path

// Import shadcn components
import { Badge } from "./ui/badge"; // Reverted path
import { Button } from "./ui/button"; // Reverted path
import { Textarea } from "./ui/textarea"; // Reverted path
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion"; // Reverted path
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"; // Reverted path
import { Separator } from "./ui/separator"; // Reverted path
import { ScrollArea } from "./ui/scroll-area"; // Reverted path

interface EntityDetailsPanelProps {
  entity: Entity | null; // Allow null for initial state or error
  allEntities: Entity[];
  relationships?: Array<{
    entity: Entity;
    relationship: Relationship;
  }>;
  onClose: () => void;
  onSelectEntity: (id: string) => void;
}

// Map relationship types to human-readable descriptions
const relationshipLabels: Record<string, string> = {
  [RelationshipTypes.DEPENDS_ON]: 'Depends on',
  [RelationshipTypes.COMPOSED_OF]: 'Composed of',
  [RelationshipTypes.CALLS]: 'Calls',
  [RelationshipTypes.EXTENDS]: 'Extends',
  [RelationshipTypes.RELATED_TO]: 'Related to'
};

// Map entity types to color classes
const entityTypeColors: Record<string, string> = {
  'component': 'bg-blue-900/10 border-blue-500/30',
  'domain':    'bg-purple-900/10 border-purple-500/30',
  'utility':   'bg-green-900/10 border-green-500/30',
  'page':      'bg-orange-900/10 border-orange-500/30',
  'function':  'bg-yellow-900/10 border-yellow-500/30',
  'class':     'bg-pink-900/10 border-pink-500/30',
  'api':       'bg-red-900/10 border-red-500/30',
  'config':    'bg-cyan-900/10 border-cyan-500/30',
  'default':   'bg-muted'
};

const EntityDetailsPanel: React.FC<EntityDetailsPanelProps> = ({ 
  entity, 
  allEntities,
  relationships = [], 
  onClose, 
  onSelectEntity
}) => {
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [editingObservationText, setEditingObservationText] = useState<string>('');
  const { projectId, editObservation, deleteObservation } = useProject();

  // Add keyboard shortcut to close panel with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Get color class based on entity type
  const getEntityTypeColorClass = (type: string): string => {
    return entityTypeColors[type.toLowerCase()] || entityTypeColors.default;
  };

  // Get human-readable relationship label
  const getRelationshipLabel = (type: string): string => {
    return relationshipLabels[type] || type;
  };

  // Get the breadcrumb path based on parent IDs
  const buildBreadcrumbPath = (currentEntityId: string, currentPath: Entity[] = []): Entity[] => {
    const currentEntity = allEntities.find(e => e.id === currentEntityId);
    if (!currentEntity) return currentPath; // Entity not found

    // Add current entity to the beginning of the path
    const newPath = [currentEntity, ...currentPath];

    // If there's a parent, recurse
    if (currentEntity.parentId) {
      return buildBreadcrumbPath(currentEntity.parentId, newPath);
    }
    
    // No more parents, return the final path
    return newPath;
  };

  const renderBreadcrumbs = () => { 
    if (!entity) return null;
    const pathEntities = buildBreadcrumbPath(entity.id);
    if (pathEntities.length <= 1) return null;
    return (
      <div className="flex items-center text-xs text-muted-foreground mt-1 mb-2">
        <span className="mr-2">Path:</span>
        {pathEntities.map((pathEntity, index) => (
          <React.Fragment key={pathEntity.id}>
            {index > 0 && <span className="mx-1">/</span>}
            {index === pathEntities.length - 1 ? (
              <span className="text-foreground">{pathEntity.name}</span>
            ) : (
              <span 
                className="text-primary/80 hover:text-primary hover:underline cursor-pointer"
                onClick={() => onSelectEntity(pathEntity.id)}
              >
                {pathEntity.name}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Handlers for observation editing/deleting
  const handleEditObservation = (observation: Observation) => {
    setEditingObservationId(observation.id);
    setEditingObservationText(observation.text);
  };

  const handleCancelEdit = () => {
    setEditingObservationId(null);
    setEditingObservationText('');
  };

  const handleSaveObservation = async () => {
    if (!editingObservationId || !projectId) return;

    console.log(`[UI handleSaveObservation] Calling editObservation with: entityId=${entity.id}, observationId=${editingObservationId}, newText=${editingObservationText} (projectId=${projectId} from context)`);

    // Pass entity.id, observationId, newText (projectId comes from context)
    try {
      await editObservation(entity.id, editingObservationId, editingObservationText);
      handleCancelEdit(); // Clear editing state
    } catch (error) {
      console.error("Failed to save observation:", error);
      alert("Failed to save observation."); // Simple alert for now
    }
  };

  const handleDeleteObservation = async (observationId: string) => {
    if (!projectId) return;

    console.log(`[UI handleDeleteObservation] Calling deleteObservation with: entityId=${entity.id}, observationId=${observationId} (projectId=${projectId} from context)`);

    if (window.confirm("Are you sure you want to delete this observation?")) {
      // Pass entity.id, observationId (projectId comes from context)
      try {
        await deleteObservation(entity.id, observationId);
        // Optionally handle success (e.g., refresh UI)
      } catch (error) {
        console.error("Failed to delete observation:", error);
        alert("Failed to delete observation."); // Simple alert for now
      }
    }
  };

  // Handle case where entity is null (e.g., loading or error)
  if (!entity) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-card border-l">
        <p className="text-muted-foreground">Select an entity to view details.</p>
      </div>
    );
  }

  // --- Render Logic --- 
  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b-2 border-slate-200 bg-card px-6 py-4">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn("border font-mono text-xs", getEntityTypeColorClass(entity.type))}>
              {entity.type}
            </Badge>
            <h2 className="text-xl font-semibold tracking-tight">{entity.name}</h2>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                   <span className="text-xs text-muted-foreground mr-2">Esc</span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Press Esc to close panel</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose} aria-label="Close details">
              <X size={16} />
            </Button>
          </div>
        </div>
        {renderBreadcrumbs()}
      </div>
      
      {/* Content using Accordion and ScrollArea */}
      <ScrollArea className="flex-1 overflow-auto p-4">
        <Accordion type="multiple" defaultValue={['description', 'relationships', 'metadata']} className="w-full">
          
          {/* Description & Observations Section */}
          <AccordionItem value="description">
            <AccordionTrigger className="text-sm font-medium px-1 hover:bg-slate-100 rounded-sm">
              <div className="flex items-center gap-2">
                <Info size={16} /> Description & Observations
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-4 px-2 space-y-4">
              {entity.description && <p className="text-sm text-muted-foreground mb-4">{entity.description}</p>}
              {entity.description && entity.observations && <Separator className="my-4" />}
              {entity.observations && entity.observations.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase">Observations</h4>
                  {entity.observations.map(obs => (
                    <div key={obs.id} className="text-sm border rounded-lg p-4 bg-white shadow-md">
                      {editingObservationId === obs.id ? (
                        <div className="space-y-2">
                          <Textarea 
                            value={editingObservationText}
                            onChange={(e) => setEditingObservationText(e.target.value)}
                            className="text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Cancel</Button>
                            <Button size="sm" onClick={handleSaveObservation}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-2">
                          <p className="flex-1 whitespace-pre-wrap">{obs.text}</p>
                          <div className="flex gap-1">
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditObservation(obs)}>
                                    <Edit size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Edit</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteObservation(obs.id)}>
                                    <Trash2 size={14} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                 !entity.description && <p className="text-sm text-muted-foreground italic">No description or observations recorded.</p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Relationships Section */}
          <AccordionItem value="relationships">
            <AccordionTrigger className="text-sm font-medium px-1 hover:bg-slate-100 rounded-sm">
              <div className="flex items-center gap-2">
                 <Link2 size={16} /> Relationships ({relationships.length})
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-4 px-2">
              {relationships.length > 0 ? (
                <ul className="space-y-3">
                  {relationships.map(({ entity: relatedEntity, relationship }) => (
                    <li key={`${relationship.id}-${relatedEntity.id}`} className="text-sm flex items-center justify-between border rounded-lg p-4 bg-white shadow-md">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-normal">
                          {getRelationshipLabel(relationship.type)}
                        </Badge>
                        <span 
                           className="text-primary hover:underline cursor-pointer"
                           onClick={() => onSelectEntity(relatedEntity.id)} 
                        >
                          {relatedEntity.name}
                        </span>
                        <Badge variant="outline" className={cn("font-mono text-xs", getEntityTypeColorClass(relatedEntity.type))}>
                          {relatedEntity.type}
                        </Badge>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">No relationships defined.</p>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Metadata Section */}
          <AccordionItem value="metadata">
            <AccordionTrigger className="text-sm font-medium px-1 hover:bg-slate-100 rounded-sm">
               <div className="flex items-center gap-2">
                 <Hash size={16} /> Metadata
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-4 px-2 text-sm space-y-2">
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Entity ID:</span>
                 <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{entity.id}</span>
               </div>
                <div className="flex justify-between">
                 <span className="text-muted-foreground">Parent ID:</span>
                 <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                   {entity.parentId ? (
                      <span 
                        className="text-primary hover:underline cursor-pointer"
                        onClick={() => onSelectEntity(entity.parentId!)} 
                      >
                        {entity.parentId}
                      </span>
                   ) : (
                     'None'
                   )}
                 </span>
               </div>
               <div className="flex justify-between">
                 <span className="text-muted-foreground">Created:</span>
                 <span>{new Date(entity.createdAt).toLocaleString()}</span>
               </div>
                {entity.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Updated:</span>
                    <span>{new Date(entity.updatedAt).toLocaleString()}</span>
                  </div>
                )}
                 {/* Add other metadata like source, etc. if available */}
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </ScrollArea>
    </div>
  );
};

export default EntityDetailsPanel;