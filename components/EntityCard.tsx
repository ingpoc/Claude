import React from 'react';
import { Code, FunctionSquare, File } from 'lucide-react';
import { cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface EntityCardProps {
  name: string;
  type: string;
  onClick?: () => void;
  className?: string;
}

const typeStyles: Record<string, { icon: React.ElementType, colorClass: string }> = {
  'class': { icon: Code, colorClass: 'text-pink-600 border-pink-600/30 bg-pink-500/10' },
  'function': { icon: FunctionSquare, colorClass: 'text-green-600 border-green-600/30 bg-green-500/10' },
  'default': { icon: File, colorClass: 'text-muted-foreground border-border bg-muted/50' }
};

const EntityCard: React.FC<EntityCardProps> = ({ name, type, onClick, className }) => {
  const styles = typeStyles[type.toLowerCase()] || typeStyles.default;
  const Icon = styles.icon;

  return (
    <Card 
      className={cn("cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50", className)}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">{name}</CardTitle>
        <Badge variant="outline" className={cn("p-1.5", styles.colorClass)}>
          <Icon size={18} />
        </Badge>
      </CardHeader>
      <CardContent>
        <Badge variant="outline" className={cn(styles.colorClass)}>{type}</Badge>
      </CardContent>
    </Card>
  );
};

export default EntityCard;