import { useEffect, useRef, useState } from 'react';
import CampoCliente, { type ClienteEscolhido } from '@/components/agenda/CampoCliente';
import { Button, Input } from '@/components/ui';
import { telefoneValido } from '@/lib/telefone';
import { clienteService, type Cliente } from '@/services/cliente.service';

export interface EstadoFamilia {
    parentesco: string;
    /** Ficha cuja família esta vai integrar. */
    entrarCom: ClienteEscolhido | null;
    sair: boolean;
}

const ESPERA_DIGITACAO_MS = 400;

/**
 * Família da ficha: mostra os membros, avisa quando telefone/e-mail já são de outra ficha
 * (a API só aceita repetir entre membros da mesma família) e permite vincular.
 */
export default function SecaoFamilia({
    editando,
    telefone,
    email,
    valor,
    onChange,
}: {
    editando: Cliente | null;
    telefone: string;
    email: string;
    valor: EstadoFamilia;
    onChange: (v: EstadoFamilia) => void;
}) {
    const [membros, setMembros] = useState<Cliente[]>([]);
    const [mesmoContato, setMesmoContato] = useState<Cliente[]>([]);
    const [buscando, setBuscando] = useState(false);
    const pedido = useRef(0);

    const familiaAtual = editando?.familiaId && !valor.sair ? editando.familiaId : null;

    useEffect(() => {
        setMembros([]);
        if (!editando?.familiaId) return;
        let vivo = true;
        clienteService
            .familia(editando.id)
            .then((m) => vivo && setMembros(m))
            .catch(() => vivo && setMembros([]));
        return () => {
            vivo = false;
        };
    }, [editando?.id, editando?.familiaId]);

    useEffect(() => {
        const tel = telefoneValido(telefone) ? telefone.replace(/\D/g, '') : '';
        const mail = email.includes('@') ? email.trim() : '';
        const atual = ++pedido.current;
        if (!tel && !mail) {
            setMesmoContato([]);
            return;
        }
        const timer = window.setTimeout(() => {
            clienteService
                .mesmoContato({ telefone: tel || undefined, email: mail || undefined, ignorarId: editando?.id })
                .then((r) => atual === pedido.current && setMesmoContato(r))
                .catch(() => atual === pedido.current && setMesmoContato([]));
        }, ESPERA_DIGITACAO_MS);
        return () => window.clearTimeout(timer);
    }, [telefone, email, editando?.id]);

    const conflitos = mesmoContato.filter(
        (c) => !(familiaAtual && c.familiaId === familiaAtual) && c.id !== valor.entrarCom?.id
    );
    const opcoesFamilia = conflitos.reduce<{ chave: string; id: number; rotulo: string; nome: string }[]>((acc, c) => {
        const chave = c.familiaId ? `f${c.familiaId}` : `c${c.id}`;
        const existente = acc.find((o) => o.chave === chave);
        if (existente) {
            existente.rotulo += `, ${c.nome}`;
        } else {
            acc.push({
                chave,
                id: c.id,
                nome: c.nome,
                rotulo: c.familiaNome ? `${c.familiaNome}: ${c.nome}` : `Família de ${c.nome}`,
            });
        }
        return acc;
    }, []);
    const outrosMembros = membros.filter((m) => m.id !== editando?.id);
    const temFamilia = Boolean(familiaAtual || valor.entrarCom);

    const entrar = (c: ClienteEscolhido | null) => {
        onChange({ ...valor, entrarCom: c, sair: false });
        setBuscando(false);
    };

    return (
        <div className="mt-5 rounded-lyra border p-4" style={{ borderColor: 'var(--line)', background: 'var(--panel2)' }}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        Família
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Fichas da mesma família podem usar o mesmo telefone e e-mail.
                    </p>
                </div>
                {!temFamilia && !buscando && (
                    <Button size="sm" variant="secondary" onClick={() => setBuscando(true)}>
                        Vincular
                    </Button>
                )}
            </div>

            {familiaAtual && !valor.entrarCom && (
                <div className="mt-3">
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        {editando?.familiaNome}
                    </p>
                    {outrosMembros.length > 0 && (
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                            {outrosMembros.map((m) => (
                                <li
                                    key={m.id}
                                    className="rounded-full border px-2.5 py-0.5 text-xs"
                                    style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                                >
                                    {m.nome}
                                    {m.parentesco ? ` · ${m.parentesco}` : ''}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {valor.entrarCom && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>
                        Vai entrar na família de <strong>{valor.entrarCom.nome}</strong>.
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => entrar(null)}>
                        Desfazer
                    </Button>
                </div>
            )}

            {valor.sair && editando?.familiaId && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>
                        Vai sair de <strong>{editando.familiaNome}</strong> ao salvar.
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => onChange({ ...valor, sair: false })}>
                        Desfazer
                    </Button>
                </div>
            )}

            {temFamilia && (
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <Input
                        label="Parentesco"
                        placeholder="Ex.: mãe, filho, responsável"
                        maxLength={40}
                        value={valor.parentesco}
                        onChange={(e) => onChange({ ...valor, parentesco: e.target.value })}
                    />
                    {familiaAtual && !valor.entrarCom && (
                        <Button size="sm" variant="ghost" onClick={() => onChange({ ...valor, sair: true })}>
                            Sair da família
                        </Button>
                    )}
                </div>
            )}

            {!temFamilia && conflitos.length > 0 && (
                <div
                    className="mt-3 rounded-lyra border px-3 py-2.5"
                    style={{
                        borderColor: 'color-mix(in oklab, var(--copper) 40%, var(--line))',
                        background: 'color-mix(in oklab, var(--copper) 8%, var(--panel))',
                    }}
                >
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>
                        Este contato já está em outra ficha. Para salvar, inclua na mesma família ou use outro contato.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {opcoesFamilia.map((o) => (
                            <Button key={o.chave} size="sm" variant="secondary" onClick={() => entrar({ id: o.id, nome: o.nome })}>
                                {o.rotulo}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {!temFamilia && buscando && (
                <div className="mt-3 flex items-start gap-2">
                    <CampoCliente
                        label="Ficha da família"
                        obrigatorio={false}
                        listaNoFluxo
                        valor={null}
                        onChange={(c) => c && entrar(c)}
                        buscar={async (texto) =>
                            (await clienteService.listar({ search: texto || undefined, page: 1, pageSize: 8 })).items
                        }
                        ocultar={(c) => c.id === editando?.id}
                    />
                    <Button size="sm" variant="ghost" className="mt-8" onClick={() => setBuscando(false)}>
                        Cancelar
                    </Button>
                </div>
            )}
        </div>
    );
}
