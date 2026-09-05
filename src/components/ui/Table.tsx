import type { HTMLAttributes, ReactNode, TdHTMLAttributes } from 'react';

function TableRoot({ children, className = '', ...props }: HTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
    return (
        <div className="overflow-x-auto rounded-lyra border" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
            <table {...props} className={`min-w-full divide-y text-sm ${className}`} style={{ borderColor: 'var(--line)', color: 'var(--muted-foreground)' }}>
                {children}
            </table>
        </div>
    );
}

function Header({ children, className = '', ...props }: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }) {
    return (
        <thead
            {...props}
            className={`text-[11px] font-semibold uppercase tracking-wider ${className}`}
            style={{ background: 'var(--panel)', color: 'var(--faint)' }}
        >
            {children}
        </thead>
    );
}

function Body({ children, className = '', ...props }: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }) {
    return (
        <tbody {...props} className={`divide-y ${className}`} style={{ borderColor: 'var(--line)' }}>
            {children}
        </tbody>
    );
}

function Row({ children, className = '', ...props }: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
    return (
        <tr {...props} className={`lyra-row ${className}`} style={{ borderColor: 'var(--line)' }}>
            {children}
        </tr>
    );
}

function Cell({ children, className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { children: ReactNode }) {
    return (
        <td {...props} className={`px-5 py-3.5 ${className}`}>
            {children}
        </td>
    );
}

const Table = Object.assign(TableRoot, { Header, Body, Row, Cell });

export default Table;
