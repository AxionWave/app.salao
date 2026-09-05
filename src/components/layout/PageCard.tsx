import type { ReactNode } from 'react';

export default function PageCard({
    children,
    className = '',
    fill = true,
}: {
    children: ReactNode;
    className?: string;
    fill?: boolean;
}) {
    return (
        <div
            className={`lyra-card ${fill ? 'flex min-h-0 w-full flex-1 flex-col overflow-hidden' : 'w-full'} ${className}`}
        >
            {fill ? <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">{children}</div> : children}
        </div>
    );
}
