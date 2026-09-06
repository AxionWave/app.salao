import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
    PAIS_PADRAO,
    formatarTelefoneDigitacao,
    listarPaisesTelefone,
    maxNacional,
    nacionalDoValor,
    paisDoTelefone,
    somenteDigitos,
    telefoneParaArmazenar,
    type PaisTelefone,
    placeholderTelefone,
} from '@/lib/telefone';

export interface PhoneInputProps {
    label?: string;
    value: string;
    onChange: (digitos: string) => void;
    required?: boolean;
    error?: string;
    helperText?: string;
    id?: string;
    disabled?: boolean;
}

export default function PhoneInput({
    label = 'Telefone',
    value,
    onChange,
    required,
    error,
    helperText,
    id,
    disabled,
}: PhoneInputProps) {
    const autoId = useId();
    const inputId = id || autoId;
    const buscaId = `${inputId}-busca`;
    const root = useRef<HTMLDivElement>(null);
    const gatilho = useRef<HTMLButtonElement>(null);
    const buscaRef = useRef<HTMLInputElement>(null);
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const [pais, setPais] = useState(() =>
        somenteDigitos(value).length > 11 ? paisDoTelefone(value) : PAIS_PADRAO,
    );
    const [menu, setMenu] = useState({ top: 0, left: 0, width: 280 });

    const paises = useMemo(() => listarPaisesTelefone(), []);
    const atual = paises.find((p) => p.iso === pais) ?? paises[0];

    const filtrados = useMemo(() => {
        const termo = busca.trim().toLowerCase().replace(/^\+/, '');
        if (!termo) return paises;
        return paises.filter(
            (p) =>
                p.nome.toLowerCase().includes(termo) ||
                p.iso.toLowerCase().includes(termo) ||
                p.ddi.includes(termo),
        );
    }, [paises, busca]);

    useEffect(() => {
        const d = somenteDigitos(value);
        if (d.length > 11) setPais(paisDoTelefone(d, pais));
        // pais propositalmente omitido: não resetar a escolha do usuário
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useEffect(() => {
        if (!aberto) return;
        const pos = () => {
            const el = gatilho.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const width = 320;
            const height = 360;
            const left = Math.min(r.left, window.innerWidth - width - 8);
            const abreCima = r.bottom + height > window.innerHeight && r.top > height;
            setMenu({
                top: abreCima ? r.top - height - 6 : r.bottom + 6,
                left: Math.max(8, left),
                width,
            });
        };
        pos();
        buscaRef.current?.focus();
        const fechar = (e: MouseEvent) => {
            const t = e.target as Node;
            if (root.current?.contains(t)) return;
            const lista = document.getElementById(`${inputId}-lista`);
            if (lista?.contains(t)) return;
            setAberto(false);
        };
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setAberto(false);
        };
        document.addEventListener('mousedown', fechar);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', pos);
        return () => {
            document.removeEventListener('mousedown', fechar);
            document.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', pos);
        };
    }, [aberto, inputId]);

    const escolher = (p: PaisTelefone) => {
        const nacional = nacionalDoValor(value, pais);
        setPais(p.iso);
        onChange(telefoneParaArmazenar(nacional, p.iso));
        setAberto(false);
        setBusca('');
    };

    const onInput = (texto: string) => {
        const nacional = somenteDigitos(texto).slice(0, maxNacional(pais));
        onChange(telefoneParaArmazenar(nacional, pais));
    };

    const visivel = formatarTelefoneDigitacao(value, pais);

    return (
        <div className="w-full" ref={root}>
            {label && (
                <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {label}
                    {required && <span style={{ color: 'var(--destructive)' }}> *</span>}
                </label>
            )}
            <div
                className="lyra-phone flex overflow-hidden"
                style={{
                    borderColor: error ? 'var(--destructive)' : undefined,
                }}
            >
                <button
                    ref={gatilho}
                    type="button"
                    disabled={disabled}
                    className="flex shrink-0 items-center gap-1.5 px-2.5 text-sm tabular-nums"
                    style={{
                        color: 'var(--ink)',
                        borderRight: '1px solid var(--input)',
                        background: 'color-mix(in oklab, var(--panel) 80%, transparent)',
                    }}
                    aria-label="Escolher país do telefone"
                    aria-expanded={aberto}
                    aria-haspopup="listbox"
                    onClick={() => setAberto((v) => !v)}
                >
                    <span aria-hidden className="text-base leading-none">
                        {atual?.bandeira}
                    </span>
                    <span className="font-medium">+{atual?.ddi}</span>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path
                            d="M3 6l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            style={{
                                transform: aberto ? 'rotate(180deg)' : undefined,
                                transformOrigin: 'center',
                            }}
                        />
                    </svg>
                </button>
                <input
                    id={inputId}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    disabled={disabled}
                    required={required}
                    placeholder={placeholderTelefone(pais)}
                    value={visivel}
                    onChange={(e) => onInput(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none"
                    style={{ color: 'var(--ink)' }}
                />
            </div>
            {error && (
                <p className="mt-1 text-xs" style={{ color: 'var(--destructive)' }}>
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p className="mt-1 text-xs" style={{ color: 'var(--faint)' }}>
                    {helperText}
                </p>
            )}

            {aberto &&
                createPortal(
                    <div
                        id={`${inputId}-lista`}
                        role="listbox"
                        className="fixed z-[90] flex flex-col overflow-hidden py-1"
                        style={{
                            top: menu.top,
                            left: menu.left,
                            width: menu.width,
                            maxHeight: 360,
                            height: 360,
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--line)',
                            background: 'var(--card)',
                            boxShadow: '0 12px 32px color-mix(in oklab, black 28%, transparent)',
                        }}
                    >
                        <div className="px-2 pb-1.5 pt-1">
                            <input
                                ref={buscaRef}
                                id={buscaId}
                                className="lyra-input mt-0 py-2 text-sm"
                                placeholder="Buscar país ou DDI"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter' && filtrados[0]) {
                                        e.preventDefault();
                                        escolher(filtrados[0]);
                                    }
                                }}
                            />
                        </div>
                        <ul className="min-h-0 flex-1 overflow-auto">
                            {filtrados.length === 0 ? (
                                <li className="px-3 py-2.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                    Nenhum país encontrado
                                </li>
                            ) : (
                                filtrados.map((p) => {
                                    const ativo = p.iso === pais;
                                    return (
                                        <li key={p.iso} role="option" aria-selected={ativo}>
                                            <button
                                                type="button"
                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                                                style={{
                                                    background: ativo
                                                        ? 'color-mix(in oklab, var(--copper) 16%, transparent)'
                                                        : 'transparent',
                                                    color: 'var(--ink)',
                                                }}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => escolher(p)}
                                            >
                                                <span className="w-6 text-base leading-none" aria-hidden>
                                                    {p.bandeira}
                                                </span>
                                                <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                                                <span className="tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                                                    +{p.ddi}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })
                            )}
                        </ul>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
