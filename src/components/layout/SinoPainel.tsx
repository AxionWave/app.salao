import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@core/services';
import { useTermos, type Termos } from '@/contexts/TermosContext';
import { podeOuvirAoVivo, useAoVivo } from '@/lib/aoVivo';
import { sincronizarPush } from '@/lib/push';
import AvisosNoAparelho from './AvisosNoAparelho';
import { painelService, type AvisoPainel } from '@/services/painel.service';
import type { Termo } from '@/services/configuracao.service';

function concorda(termo: Termo, masculino: string, feminino: string): string {
    return termo.genero === 'f' ? feminino : masculino;
}

function titulo(a: AvisoPainel, termos: Termos): string {
    const termo = termos.agendamento;
    switch (a.evento) {
        case 'agendamento_criado':
            return termos.novo('agendamento');
        case 'agendamento_remarcado':
            return `${termo.singular} ${concorda(termo, 'alterado', 'alterada')}`;
        case 'agendamento_cancelado':
            return `${termo.singular} ${concorda(termo, 'cancelado', 'cancelada')}`;
        case 'agendamento_confirmado':
            return a.origem === 'cliente'
                ? `${termos.cliente.singular} confirmou presença`
                : 'Presença confirmada';
        default:
            return a.evento;
    }
}

/** `dd/MM/yyyy HH:mm` → `dd/MM às HH:mm`. */
function quando(local: string): string {
    const [data, hora] = local.split(' ');
    return hora ? `${data.slice(0, 5)} às ${hora}` : local;
}

/** `dd/MM/yyyy …` → `yyyy-MM-dd`, para abrir a Agenda no dia. */
function diaIso(local: string): string | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(local);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function haQuanto(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ontem' : `há ${d} dias`;
}

/** Sino do cabeçalho: avisos da agenda que outras pessoas (ou o cliente) fizeram, ao vivo. */
export default function SinoPainel() {
    const navigate = useNavigate();
    const termos = useTermos();
    const [itens, setItens] = useState<AvisoPainel[]>([]);
    const [naoLidas, setNaoLidas] = useState(0);
    const [aberto, setAberto] = useState(false);
    const caixa = useRef<HTMLDivElement>(null);
    const meuId = Number(authService.getStoredUserInfo()?.userId ?? 0);

    const carregar = useCallback(() => {
        painelService
            .listar()
            .then((r) => {
                setItens(r.itens);
                setNaoLidas(r.naoLidas);
            })
            .catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!podeOuvirAoVivo()) return;
        carregar();
        void sincronizarPush();
    }, [carregar]);

    useAoVivo<AvisoPainel>(
        'notificacao',
        (aviso) => {
            if (aviso.autorId === meuId) return;
            setItens((atual) => [aviso, ...atual.filter((a) => a.id !== aviso.id)].slice(0, 30));
            if (aberto) void painelService.marcarVistas().catch(() => undefined);
            else setNaoLidas((n) => n + 1);
        },
        carregar
    );

    useEffect(() => {
        if (!aberto) return;
        const fora = (e: MouseEvent) => {
            if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
        };
        const esc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setAberto(false);
        };
        document.addEventListener('mousedown', fora);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', fora);
            document.removeEventListener('keydown', esc);
        };
    }, [aberto]);

    if (!podeOuvirAoVivo()) return null;

    const alternar = () => {
        const abrir = !aberto;
        setAberto(abrir);
        if (abrir && naoLidas > 0) {
            setNaoLidas(0);
            void painelService.marcarVistas().catch(() => undefined);
        }
    };

    const abrirNaAgenda = (a: AvisoPainel) => {
        setAberto(false);
        const dia = diaIso(a.inicioLocal);
        navigate(dia ? `/agenda?data=${dia}&visao=dia` : '/agenda');
    };

    return (
        <div ref={caixa} className="relative">
            <button
                type="button"
                onClick={alternar}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lyra border transition-colors"
                style={{ borderColor: 'var(--lyra-border)', backgroundColor: 'var(--lyra-surface)', color: 'var(--lyra-text)' }}
                title="Avisos da agenda"
                aria-label={naoLidas > 0 ? `Avisos da agenda: ${naoLidas} novos` : 'Avisos da agenda'}
                aria-expanded={aberto}
            >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>
                {naoLidas > 0 && (
                    <span
                        className="absolute -right-1.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums"
                        style={{ background: 'var(--destructive)', color: '#fff' }}
                    >
                        {naoLidas > 9 ? '9+' : naoLidas}
                    </span>
                )}
            </button>

            {aberto && (
                <div
                    className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lyra border shadow-lg"
                    style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                    role="dialog"
                    aria-label="Avisos da agenda"
                >
                    <p
                        className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em]"
                        style={{ borderColor: 'var(--line)', color: 'var(--faint)' }}
                    >
                        Avisos da agenda
                    </p>
                    {itens.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            Nenhum aviso por enquanto. Quando alguém marcar, alterar ou cancelar, aparece aqui.
                        </p>
                    ) : (
                        <ul className="max-h-96 overflow-y-auto">
                            {itens.map((a) => (
                                <li key={a.id}>
                                    <button
                                        type="button"
                                        onClick={() => abrirNaAgenda(a)}
                                        className="flex w-full flex-col gap-0.5 border-b px-4 py-2.5 text-left transition-colors hover:bg-[var(--panel)]"
                                        style={{ borderColor: 'var(--line)' }}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                                {titulo(a, termos)}
                                            </span>
                                            <span className="shrink-0 text-[0.65rem]" style={{ color: 'var(--faint)' }}>
                                                {haQuanto(a.data)}
                                            </span>
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                            {a.cliente} · {a.profissional} · {quando(a.inicioLocal)}
                                        </span>
                                        {a.evento === 'agendamento_remarcado' && a.inicioAnteriorLocal && (
                                            <span className="text-xs line-through" style={{ color: 'var(--faint)' }}>
                                                Antes: {quando(a.inicioAnteriorLocal)}
                                            </span>
                                        )}
                                        {a.evento === 'agendamento_cancelado' && a.motivo && (
                                            <span className="text-xs" style={{ color: 'var(--faint)' }}>
                                                Motivo: {a.motivo}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <AvisosNoAparelho />
                </div>
            )}
        </div>
    );
}
