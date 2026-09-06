import type { ReactNode } from 'react';

export interface AlertProps {
    children: ReactNode;
    titulo?: string;
    variant?: 'danger' | 'warn';
}

export default function Alert({ children, titulo, variant = 'danger' }: AlertProps) {
    const perigo = variant === 'danger';
    return (
        <div
            role="alert"
            className="flex gap-3 rounded-lyra border px-3.5 py-3"
            style={{
                borderColor: perigo
                    ? 'color-mix(in oklab, var(--destructive) 35%, var(--line))'
                    : 'color-mix(in oklab, var(--warn) 40%, var(--line))',
                background: perigo ? 'var(--lyra-danger-bg)' : 'color-mix(in oklab, var(--warn) 12%, var(--panel))',
            }}
        >
            <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={{
                    color: perigo ? 'var(--destructive)' : 'var(--warn)',
                    background: 'color-mix(in oklab, currentColor 16%, transparent)',
                }}
                aria-hidden
            >
                !
            </span>
            <div className="min-w-0 text-sm">
                {titulo && (
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                        {titulo}
                    </p>
                )}
                <p className={titulo ? 'mt-0.5' : ''} style={{ color: 'var(--muted-foreground)' }}>
                    {children}
                </p>
            </div>
        </div>
    );
}
