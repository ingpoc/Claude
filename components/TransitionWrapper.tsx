import React, { useState, useEffect } from 'react';

interface TransitionWrapperProps {
  children: React.ReactNode;
  isVisible?: boolean;
  direction?: 'fade' | 'right' | 'left' | 'up' | 'down';
  duration?: number;
  delay?: number;
  className?: string;
}

const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  children,
  isVisible = true,
  direction = 'fade',
  duration = 300,
  delay = 0,
  className = '',
}) => {
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) setShouldRender(true);
    let timeoutId: NodeJS.Timeout;
    
    if (!isVisible && shouldRender) {
      timeoutId = setTimeout(() => {
        setShouldRender(false);
      }, duration);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isVisible, duration, shouldRender]);

  if (!shouldRender) return null;

  const getDirectionClasses = () => {
    switch (direction) {
      case 'right':
        return `transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`;
      case 'left':
        return `transform ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'}`;
      case 'up':
        return `transform ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`;
      case 'down':
        return `transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`;
      case 'fade':
      default:
        return isVisible ? 'opacity-100' : 'opacity-0';
    }
  };

  return (
    <div
      className={`transition-all ease-in-out ${getDirectionClasses()} ${className}`}
      style={{ transitionDuration: `${duration}ms`, transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

export default TransitionWrapper; 