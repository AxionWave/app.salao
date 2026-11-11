import { useEffect, useState } from 'react';
import { Alert, Badge } from '@/components/ui';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { fusoAtual } from '@/lib/fuso';
import { CANAIS, EVENTOS, notificacaoService, type Notificacao } from '@/services/notificacao.service';

const STATUS: Record<Notificacao['status'], { rotulo: string; variant: 'ok' | 'copper' | 'warn' | 'danger' }> = {
    entregue: { rotulo: 'Entregue', variant: 'ok' },
    enviado: { rotulo: 'Enviado', variant: 'copper' },
    pendente: { rotulo: 'Na fila', variant: 'warn' },
    falhou: { rotulo: 'Falhou', variant: 'danger' },
};

function quando(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: fusoAtual() ?? undefined,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(iso));
}

/** Histórico do que o Lyra mandou (ou tentou mandar) para este cliente. */
export default function MensagensCliente({ clienteId }: { clienteId: number }) {
    const [itens, setItens] = useState<Notificacao[] | null>(null);
    const [erro, setErro] = useState('');

    useEffect(() => {
        let vivo = true;
        setItens(null);
        setErro('');
        notificacaoService
            .historicoCliente(clienteId)
            .then((lista) => vivo && setItens(lista))
            .catch((e) => vivo && setErro(mensagemErroHttp(e)));
        return () => {
            vivo = false;
        };
    }, [clienteId]);

    if (erro) return <Alert titulo={tituloDeMensagem(erro)}>{erro}</Alert>;
    if (!itens) {
        return (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Carregando mensagens…
            </p>
        );
    }
    if (itens.length === 0) {
        return (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Nenhuma mensagem enviada ainda. Quando o aviso por e-mail estiver ligado em Configurações, os envios aparecem
                aqui.
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-2">
            {itens.map((n) => {
                const status = STATUS[n.status] ?? STATUS.pendente;
                return (
                    <li
                        key={n.id}
                        className="rounded-lyra border px-4 py-3"
                        style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                {EVENTOS[n.evento] ?? n.evento}
                                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>
                                    {CANAIS[n.canal] ?? n.canal}
                                    {n.destino ? ` · ${n.destino}` : ''}
                                </span>
                            </p>
                            <Badge variant={status.variant} size="sm">
                                {status.rotulo}
                            </Badge>
                        </div>
                        <p className="mt-1 text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
                            {n.dataEnvio ? `Enviado em ${quando(n.dataEnvio)}` : `Criado em ${quando(n.dataCriacao)}`}
                            {(n.status === 'pendente' || n.status === 'falhou') && n.tentativas > 0
                                ? ` · ${n.tentativas} ${n.tentativas === 1 ? 'tentativa' : 'tentativas'}`
                                : ''}
                        </p>
                        {n.ultimoErro && n.status !== 'enviado' && (
                            <p className="mt-1 text-xs" style={{ color: 'var(--destructive)' }}>
                                {n.ultimoErro}
                            </p>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
