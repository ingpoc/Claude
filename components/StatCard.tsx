import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'; // Relative path
import { cn } from '../lib/utils'; // Relative path

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ElementType; // Optional icon component (e.g., from lucide-react)
  unit?: string; // Optional unit label (e.g., 'kg', 'Entities')
  description?: string; // Optional description text
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  unit,
  description,
  className
}) => {
  return (
    <Card className={cn(className)}> 
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />} 
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value} {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground pt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard; 