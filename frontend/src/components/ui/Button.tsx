import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          // Primary: Google blue solid button
          'bg-primary text-primary-foreground hover:brightness-95 shadow-sm': variant === 'default',

          // Destructive: Red button
          'bg-destructive text-destructive-foreground hover:brightness-95 shadow-sm': variant === 'destructive',

          // Outline: White bg with border and blue text
          'border border-border bg-card text-primary hover:bg-accent hover:text-accent-foreground': variant === 'outline',

          // Secondary: Gray button (replacing yellow)
          'bg-muted text-foreground hover:bg-accent': variant === 'secondary',

          // Ghost: Transparent with hover wash
          'text-foreground hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        },
        {
          'h-9 px-4 text-sm': size === 'default',  // 36px height like Google
          'h-8 px-3 text-xs': size === 'sm',        // Smaller
          'h-10 px-6 text-base': size === 'lg',     // Larger
        },
        className
      )}
      {...props}
    />
  );
}
