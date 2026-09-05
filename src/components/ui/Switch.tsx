export interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    descricao?: string;
}

export default function Switch({ checked, onChange, label, descricao }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-4 rounded-lyra border px-4 py-3.5 text-left transition-colors"
            style={{
                borderColor: checked
                    ? 'color-mix(in oklab, var(--copper) 45%, var(--line))'
                    : 'var(--line)',
                background: checked
                    ? 'color-mix(in oklab, var(--copper) 10%, var(--panel))'
                    : 'var(--panel)',
            }}
        >
            <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {label}
                </span>
                {descricao && (
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {descricao}
                    </span>
                )}
            </span>
            <span
                className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                style={{
                    background: checked ? 'var(--gradient-copper)' : 'var(--line)',
                }}
            >
                <span
                    className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
                    style={{
                        left: 2,
                        transform: checked ? 'translateX(1.25rem)' : 'translateX(0)',
                        background: checked ? 'var(--primary-foreground)' : 'var(--card)',
                        boxShadow: '0 1px 3px color-mix(in oklab, black 25%, transparent)',
                    }}
                />
            </span>
        </button>
    );
}
