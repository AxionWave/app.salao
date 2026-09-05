import type { HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'copper' | 'ok' | 'danger' | 'warn' | 'faint';
    size?: 'sm' | 'md';
    children: ReactNode;
}

export default function Badge({
    variant = 'copper',
    size = 'md',
    className = '',
    children,
    ...props
}: BadgeProps) {
    const tones: Record<NonNullable<BadgeProps['variant']>, { bg: string; fg: string }> = {
        copper: {
            bg: 'color-mix(in oklab, var(--copper) 18%, transparent)',
            fg: 'var(--copper)',
        },
        ok: {
            bg: 'color-mix(in oklab, var(--ok) 18%, transparent)',
            fg: 'var(--ok)',
        },
        danger: {
            bg: 'var(--lyra-danger-bg)',
            fg: 'var(--destructive)',
        },
        warn: {
            bg: 'color-mix(in oklab, var(--warn) 18%, transparent)',
            fg: 'var(--warn)',
        },
        faint: {
            bg: 'var(--panel2)',
            fg: 'var(--faint)',
        },
    };

    const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
    const tone = tones[variant];

    return (
        <span
            {...props}
            className={`inline-flex items-center rounded-full font-semibold ${sizeClass} ${className}`}
            style={{ background: tone.bg, color: tone.fg }}
        >
            {children}
        </span>
    );
}
