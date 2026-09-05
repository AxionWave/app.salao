import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
    aberto: boolean;
    titulo: string;
    subtitulo?: string;
    eyebrow?: string;
    onClose: () => void;
    children: ReactNode;
    rodape?: ReactNode;
    largura?: string;
}

export default function Modal({
    aberto,
    titulo,
    subtitulo,
    eyebrow,
    onClose,
    children,
    rodape,
    largura = '36rem',
}: ModalProps) {
    useEffect(() => {
        if (!aberto) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKey);
        };
    }, [aberto, onClose]);

    if (!aberto) return null;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
            <button
                type="button"
                className="lyra-fade absolute inset-0"
                style={{
                    background: 'color-mix(in oklab, var(--background) 35%, black 50%)',
                    backdropFilter: 'blur(10px)',
                }}
                aria-label="Fechar"
                onClick={onClose}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="lyra-modal-titulo"
                className="lyra-rise relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden sm:max-w-[min(100%,var(--lyra-modal-w))]"
                style={{
                    ['--lyra-modal-w' as string]: largura,
                    borderRadius: 'var(--lyra-radius-lg)',
                    border: '1px solid color-mix(in oklab, var(--copper) 28%, var(--line))',
                    background: 'var(--card)',
                    boxShadow: 'var(--lyra-shadow-md), 0 0 0 1px color-mix(in oklab, var(--copper) 12%, transparent)',
                }}
            >
                <div
                    className="h-[3px] w-full shrink-0"
                    style={{ background: 'var(--gradient-copper)' }}
                    aria-hidden
                />
                <div className="relative px-6 pb-4 pr-16 pt-5">
                    {eyebrow && (
                        <p
                            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                            style={{ color: 'var(--copper)' }}
                        >
                            {eyebrow}
                        </p>
                    )}
                    <h2
                        id="lyra-modal-titulo"
                        className={`font-display text-2xl font-semibold tracking-tight ${eyebrow ? 'mt-1' : ''}`}
                        style={{ color: 'var(--ink)' }}
                    >
                        {titulo}
                    </h2>
                    {subtitulo && (
                        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {subtitulo}
                        </p>
                    )}
                    <button
                        type="button"
                        className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full"
                        style={{
                            color: 'var(--faint)',
                            border: '1px solid var(--line)',
                            background: 'var(--panel)',
                        }}
                        aria-label="Fechar"
                        onClick={onClose}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                            <path
                                d="M2 2l8 8M10 2L2 10"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>
                <div className="min-h-0 flex-1 px-6 py-1">{children}</div>
                {rodape && (
                    <div
                        className="mt-2 flex justify-end gap-2 border-t px-6 py-4"
                        style={{
                            borderColor: 'var(--line)',
                            background: 'color-mix(in oklab, var(--panel2) 70%, transparent)',
                        }}
                    >
                        {rodape}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
