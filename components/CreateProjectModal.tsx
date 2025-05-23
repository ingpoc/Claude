"use client";

import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { X, Plus, Sparkles, FolderPlus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Enhanced animations
  useEffect(() => {
    if (!modalRef.current || !backdropRef.current || !contentRef.current) return;

    if (isOpen) {
      // Show modal with animations
      gsap.set(modalRef.current, { display: 'flex' });
      gsap.set(backdropRef.current, { opacity: 0 });
      gsap.set(contentRef.current, { opacity: 0, scale: 0.8, y: 30 });

      const tl = gsap.timeline();
      tl.to(backdropRef.current, { opacity: 1, duration: 0.3 })
        .to(contentRef.current, { 
          opacity: 1, 
          scale: 1, 
          y: 0, 
          duration: 0.5, 
          ease: "back.out(1.2)" 
        }, "-=0.1");
    } else {
      // Hide modal with animations
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set(modalRef.current, { display: 'none' });
        }
      });
      
      tl.to(contentRef.current, { 
        opacity: 0, 
        scale: 0.8, 
        y: -20, 
        duration: 0.3, 
        ease: "power2.in" 
      })
      .to(backdropRef.current, { opacity: 0, duration: 0.2 }, "-=0.1");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    
    // Add a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onSubmit(name.trim(), description.trim());
    setName('');
    setDescription('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setName('');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ display: 'none' }}
    >
      {/* Enhanced backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Enhanced modal content */}
      <Card 
        ref={contentRef}
        className="relative w-full max-w-md bg-white/95 backdrop-blur-sm border-white/20 shadow-2xl"
      >
        {/* Enhanced header */}
        <CardHeader className="pb-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-b border-gray-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/20">
                <FolderPlus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                  Create New Project
                </CardTitle>
                <p className="text-sm text-muted-foreground">Start building your knowledge graph</p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project name input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Project Name
                <Badge variant="secondary" className="text-xs">Required</Badge>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name..."
                disabled={isSubmitting}
                className="bg-white/80 border-gray-200/60 focus:border-blue-300 focus:ring-blue-200"
                autoFocus
              />
            </div>

            {/* Project description input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Description
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project's purpose and goals..."
                disabled={isSubmitting}
                className="bg-white/80 border-gray-200/60 focus:border-blue-300 focus:ring-blue-200 min-h-[80px] resize-none"
              />
            </div>

            {/* Enhanced action buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 bg-white/60 border-gray-200/60 hover:bg-white/80"
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Creating...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </div>
                )}
              </Button>
            </div>
          </form>

          {/* Enhanced tips section */}
          <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-200/20">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded-md bg-blue-100">
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-1">Pro Tips</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Choose a descriptive name that reflects your domain</li>
                  <li>• Add a clear description to help collaborators understand the scope</li>
                  <li>• You can always edit these details later</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateProjectModal;