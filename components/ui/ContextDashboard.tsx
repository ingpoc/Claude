"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';
import { Separator } from './separator';
import { ScrollArea } from './scroll-area';
import { cn } from '../../lib/utils';
import { 
  MessageSquare, 
  Brain, 
  Clock, 
  Search, 
  Lightbulb, 
  AlertTriangle,
  User,
  Target,
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';

interface ContextSession {
  id: string;
  userId: string;
  projectId: string;
  isActive: boolean;
  lastActive: Date;
  totalMessages: number;
  activeEntities: string[];
  currentTopic?: string;
  sessionSummary?: string;
}

interface Conversation {
  id: string;
  userMessage: string;
  aiResponse: string;
  timestamp: Date;
  intent?: string;
  extractedEntities: string[];
}

interface ContextData {
  session?: ContextSession;
  recentConversations: Conversation[];
  suggestedActions: string[];
  knowledgeGaps: string[];
  relevantEntities: string[];
}

interface ContextDashboardProps {
  projectId: string;
  className?: string;
}

export const ContextDashboard: React.FC<ContextDashboardProps> = ({
  projectId,
  className
}) => {
  const [contextData, setContextData] = useState<ContextData>({
    recentConversations: [],
    suggestedActions: [],
    knowledgeGaps: [],
    relevantEntities: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for demo - replace with actual API calls
  useEffect(() => {
    const mockData: ContextData = {
      session: {
        id: 'session-123',
        userId: 'user-1',
        projectId,
        isActive: true,
        lastActive: new Date(),
        totalMessages: 24,
        activeEntities: ['entity-1', 'entity-2', 'entity-3'],
        currentTopic: 'Migration Planning',
        sessionSummary: 'Working on atom-to-quark migration automation'
      },
      recentConversations: [
        {
          id: '1',
          userMessage: 'How do I handle the migration of JavaScript components?',
          aiResponse: 'For JavaScript component migration, you should focus on pattern matching and AST transformations...',
          timestamp: new Date(Date.now() - 300000),
          intent: 'technical_guidance',
          extractedEntities: ['entity-1']
        },
        {
          id: '2',
          userMessage: 'What are the performance implications?',
          aiResponse: 'The performance impact depends on several factors including bundle size and runtime overhead...',
          timestamp: new Date(Date.now() - 600000),
          intent: 'performance_analysis',
          extractedEntities: ['entity-2']
        }
      ],
      suggestedActions: [
        'Review migration test cases for edge scenarios',
        'Document component mapping strategies',
        'Set up automated migration pipelines',
        'Create rollback procedures'
      ],
      knowledgeGaps: [
        'Missing documentation for legacy component patterns',
        'Need more test coverage for complex migrations'
      ],
      relevantEntities: ['JavaScript Automation Features', 'Migration Toolkit', 'Performance Metrics']
    };
    setContextData(mockData);
  }, [projectId]);

  return (
    <div className="space-y-6">
      {/* Session Overview - Full width */}
      {contextData.session && (
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-slate-600" />
                Active Session
              </CardTitle>
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{contextData.session.totalMessages}</div>
                <div className="text-sm text-slate-500">Messages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">{contextData.session.activeEntities.length}</div>
                <div className="text-sm text-slate-500">Active Entities</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">
                  {Math.floor((Date.now() - contextData.session.lastActive.getTime()) / 60000)}m
                </div>
                <div className="text-sm text-slate-500">Last Active</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-slate-700">Topic</div>
                <div className="text-sm text-slate-500 truncate">{contextData.session.currentTopic || 'General'}</div>
              </div>
            </div>
            {contextData.session.sessionSummary && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-700">{contextData.session.sessionSummary}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid - Aligned with parent layout */}
      <div className={cn("grid grid-cols-1 gap-6", className)}>
        {/* Recent Conversations - 2 columns to align with Natural Language Query above */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 bg-white shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-slate-600" />
                  Recent Conversations
                </CardTitle>
                <Button variant="outline" size="sm" className="text-slate-600 border-slate-200">
                  <Search className="h-4 w-4 mr-2" />
                  Search History
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-80">
                <div className="space-y-4">
                  {contextData.recentConversations.map((conversation, index) => (
                    <div key={conversation.id} className="border-l-4 border-slate-200 pl-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">You</span>
                            <span className="text-xs text-slate-400">
                              {conversation.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3 bg-slate-50 p-2 rounded">
                            {conversation.userMessage}
                          </p>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">AI Assistant</span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3">
                            {conversation.aiResponse.substring(0, 150)}...
                          </p>
                          
                          {conversation.extractedEntities.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {conversation.extractedEntities.map((entity, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                                  {entity}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {index < contextData.recentConversations.length - 1 && (
                        <Separator className="mt-4 bg-slate-100" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Context Sidebar - 1 column to align with Smart Suggestions above */}
        <div className="lg:col-span-1 space-y-6">
          {/* Knowledge Gaps */}
          {contextData.knowledgeGaps.length > 0 && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Knowledge Gaps
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {contextData.knowledgeGaps.map((gap, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-amber-50">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{gap}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Relevant Entities */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-slate-600" />
                Active Context
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {contextData.relevantEntities.map((entity, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                    <span className="text-sm text-slate-700">{entity}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}; 