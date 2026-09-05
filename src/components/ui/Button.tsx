import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    children: ReactNode;
}

export default function Button({
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
    type = 'button',
    disabled,
    ...props
}: ButtonProps) {
    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    const variants = {
        primary: 'lyra-cta border-0',
        secondary:
            'border bg-[var(--card)] text-[var(--ink)] border-[var(--line)] hover:border-[color-mix(in_oklab,var(--copper)_40%,transparent)]',
        danger: 'border-0 bg-[var(--lyra-danger-bg)] text-[var(--destructive)]',
        ghost: 'border-0 bg-transparent text-[var(--muted-foreground)] hover:text-[var(--ink)]',
    };

    return (
        <button
            {...props}
            type={type}
            disabled={disabled}
            className={`inline-flex items-center justify-center rounded-lyra font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
        >
            {children}
        </button>
    );
}
