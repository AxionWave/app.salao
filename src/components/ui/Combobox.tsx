import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface ComboboxProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
}

export default function Combobox({ label, value, onChange, options, placeholder }: ComboboxProps) {
    const id = useId();
    const root = useRef<HTMLDivElement>(null);
    const [aberto, setAberto] = useState(false);
    const [destaque, setDestaque] = useState(0);

    const filtradas = useMemo(() => {
        const termo = value.trim().toLowerCase();
        if (!termo) return options;
        return options.filter((o) => o.toLowerCase().includes(termo));
    }, [options, value]);

    const nova = value.trim() && !options.some((o) => o.toLowerCase() === value.trim().toLowerCase());

    useEffect(() => {
        const fechar = (e: MouseEvent) => {
            if (!root.current?.contains(e.target as Node)) setAberto(false);
        };
        document.addEventListener('mousedown', fechar);
        return () => document.removeEventListener('mousedown', fechar);
    }, []);

    useEffect(() => {
        setDestaque(0);
    }, [filtradas, nova]);

    const escolher = (texto: string) => {
        onChange(texto);
        setAberto(false);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        const total = filtradas.length + (nova ? 1 : 0);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAberto(true);
            setDestaque((i) => (total ? (i + 1) % total : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAberto(true);
            setDestaque((i) => (total ? (i - 1 + total) % total : 0));
        } else if (e.key === 'Enter' && aberto && total) {
            e.preventDefault();
            if (nova && destaque === 0) escolher(value.trim());
            else escolher(filtradas[nova ? destaque - 1 : destaque]);
        } else if (e.key === 'Escape') {
            setAberto(false);
        }
    };

    return (
        <div ref={root} className="relative w-full">
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    className="lyra-input pr-10"
                    style={{ marginTop: 0 }}
                    autoComplete="off"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setAberto(true);
                    }}
                    onFocus={() => setAberto(true)}
                    onKeyDown={onKeyDown}
                    aria-expanded={aberto}
                    aria-controls={`${id}-lista`}
                    aria-autocomplete="list"
                />
                <button
                    type="button"
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                    style={{ color: 'var(--faint)' }}
                    aria-label={aberto ? 'Fechar categorias' : 'Abrir categorias'}
                    onClick={() => setAberto((v) => !v)}
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path
                            d="M3 6l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ transform: aberto ? 'rotate(180deg)' : undefined, transformOrigin: 'center' }}
                        />
                    </svg>
                </button>
            </div>

            {aberto && (options.length > 0 || nova) && (
                <ul
                    id={`${id}-lista`}
                    role="listbox"
                    className="absolute z-30 mt-1.5 max-h-52 w-full overflow-auto py-1"
                    style={{
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--line)',
                        background: 'var(--card)',
                        boxShadow: '0 12px 32px color-mix(in oklab, black 28%, transparent)',
                    }}
                >
                    {nova && (
                        <li role="option" aria-selected={destaque === 0}>
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
                                style={{
                                    background:
                                        destaque === 0
                                            ? 'color-mix(in oklab, var(--copper) 16%, transparent)'
                                            : 'transparent',
                                    color: 'var(--ink)',
                                }}
                                onMouseEnter={() => setDestaque(0)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => escolher(value.trim())}
                            >
                                <span
                                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{
                                        background: 'color-mix(in oklab, var(--copper) 18%, transparent)',
                                        color: 'var(--copper)',
                                    }}
                                >
                                    Nova
                                </span>
                                Usar «{value.trim()}»
                            </button>
                        </li>
                    )}
                    {filtradas.length === 0 && !nova ? (
                        <li className="px-3 py-2.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            Nenhuma categoria ainda
                        </li>
                    ) : (
                        filtradas.map((c, i) => {
                            const idx = nova ? i + 1 : i;
                            const ativo = destaque === idx;
                            const selecionada = c.toLowerCase() === value.trim().toLowerCase();
                            return (
                                <li key={c} role="option" aria-selected={selecionada}>
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
                                        style={{
                                            background: ativo
                                                ? 'color-mix(in oklab, var(--copper) 16%, transparent)'
                                                : 'transparent',
                                            color: 'var(--ink)',
                                        }}
                                        onMouseEnter={() => setDestaque(idx)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => escolher(c)}
                                    >
                                        {c}
                                        {selecionada && (
                                            <span className="text-xs font-semibold" style={{ color: 'var(--copper)' }}>
                                                ✓
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
}
