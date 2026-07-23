'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const sizeClass = size === 'sm' ? 'pc-button-sm' : size === 'icon' ? 'pc-button-icon' : '';

  return (
    <button
      type={type}
      className={`pc-button pc-button-${variant} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {icon}
      {size === 'icon' ? null : children}
    </button>
  );
}
