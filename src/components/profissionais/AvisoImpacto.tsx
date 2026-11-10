import { Alert } from '@/components/ui';
import { labelStatus } from '@/lib/agenda';
import type { ImpactoProfissional } from '@/services/profissional.service';
import { useTermos } from '@/contexts/TermosContext';

const formatarDiaHora = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

/** Lista os agendamentos futuros em aberto que ficam sem atendimento. */
export default function AvisoImpacto({ impacto, titulo }: { impacto: ImpactoProfissional; titulo: string }) {
    const termos = useTermos();
    const restantes = impacto.total - impacto.itens.length;
    return (
        <Alert titulo={titulo} variant="warn">
            <p>
                {`${impacto.total} ${termos.contagem('agendamento', impacto.total)} em aberto. Nada é cancelado sozinho: remarque ou cancele pela agenda.`}
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                {impacto.itens.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3">
                        <span className="truncate">{a.clienteNome}</span>
                        <span className="shrink-0 font-mono tabular-nums">
                            {formatarDiaHora(a.inicio)} · {labelStatus(a.status)}
                        </span>
                    </li>
                ))}
            </ul>
            {restantes > 0 && <p className="mt-1 text-xs">{`e mais ${restantes}.`}</p>}
        </Alert>
    );
}
