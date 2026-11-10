import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Switch } from '@/components/ui';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { adicionarDias, cloneDia, deDatetimeLocal, isoData, paraDatetimeLocal, parseIsoData } from '@/lib/agenda';
import { bloqueioService, type Bloqueio } from '@/services/bloqueio.service';
import type { ProfissionalAgenda } from '@/services/agendamento.service';
import { useTermos } from '@/contexts/TermosContext';

type Form = {
    profissionalId: string;
    diaInteiro: boolean;
    dataInicio: string;
    dataFim: string;
    inicio: string;
    fim: string;
    motivo: string;
};

function formInicial(dia: Date, profissionalId?: number): Form {
    const d = cloneDia(dia);
    const ini = new Date(d);
    ini.setHours(12, 0, 0, 0);
    const fim = new Date(d);
    fim.setHours(13, 0, 0, 0);
    return {
        profissionalId: profissionalId ? String(profissionalId) : '',
        diaInteiro: true,
        dataInicio: isoData(d),
        dataFim: isoData(d),
        inicio: paraDatetimeLocal(ini),
        fim: paraDatetimeLocal(fim),
        motivo: '',
    };
}

function periodoDoForm(f: Form): { inicio: Date; fim: Date } | null {
    if (f.diaInteiro) {
        const a = parseIsoData(f.dataInicio);
        const b = parseIsoData(f.dataFim);
        if (!a || !b) return null;
        return { inicio: a, fim: adicionarDias(b, 1) };
    }
    const inicio = deDatetimeLocal(f.inicio);
    const fim = deDatetimeLocal(f.fim);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return null;
    return { inicio, fim };
}

export function descreverPeriodo(b: Pick<Bloqueio, 'inicio' | 'fim'>): string {
    const ini = new Date(b.inicio);
    const fim = new Date(b.fim);
    const data = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const meiaNoite = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;
    if (meiaNoite(ini) && meiaNoite(fim)) {
        const ultimo = adicionarDias(fim, -1);
        return ultimo.getTime() === cloneDia(ini).getTime()
            ? `${data(ini)}, dia todo`
            : `${data(ini)} a ${data(ultimo)}, dias inteiros`;
    }
    if (cloneDia(ini).getTime() === cloneDia(fim).getTime()) {
        return `${data(ini)}, ${hora(ini)}–${hora(fim)}`;
    }
    return `${data(ini)} ${hora(ini)} a ${data(fim)} ${hora(fim)}`;
}

export default function BloqueioModal({
    aberto,
    onClose,
    onAlterado,
    profissionais,
    dia,
    profissionalId,
    selecionado,
}: {
    aberto: boolean;
    onClose: () => void;
    onAlterado: () => void;
    profissionais: ProfissionalAgenda[];
    dia: Date;
    profissionalId?: number;
    /** Abre direto no detalhe de um bloqueio (clique na grade). */
    selecionado?: Bloqueio | null;
}) {
    const termos = useTermos();
    const [form, setForm] = useState<Form>(() => formInicial(dia, profissionalId));
    const [proximos, setProximos] = useState<Bloqueio[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [excluindo, setExcluindo] = useState<number | null>(null);
    const [erro, setErro] = useState('');
    const [aviso, setAviso] = useState('');

    const carregarProximos = useCallback(async () => {
        setCarregando(true);
        try {
            const de = cloneDia(new Date());
            setProximos(await bloqueioService.listar({ de: de.toISOString(), ate: adicionarDias(de, 120).toISOString() }));
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        if (!aberto) return;
        setForm(formInicial(dia, profissionalId));
        setErro('');
        setAviso('');
        if (!selecionado) void carregarProximos();
    }, [aberto, dia, profissionalId, selecionado, carregarProximos]);

    const patch = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
    const periodo = periodoDoForm(form);
    const periodoValido = Boolean(periodo && periodo.fim > periodo.inicio);
    const ocupado = salvando || excluindo !== null;

    const salvar = async () => {
        if (!periodo || !periodoValido) {
            setErro('O fim precisa ser depois do início.');
            return;
        }
        setSalvando(true);
        setErro('');
        setAviso('');
        try {
            const r = await bloqueioService.criar({
                profissionalId: form.profissionalId ? Number(form.profissionalId) : null,
                inicio: periodo.inicio.toISOString(),
                fim: periodo.fim.toISOString(),
                motivo: form.motivo.trim() || null,
            });
            onAlterado();
            if (r.agendamentosNoPeriodo > 0) {
                const n = r.agendamentosNoPeriodo;
                setAviso(
                    `Bloqueio criado. Já existem ${n} ${termos.contagem('agendamento', n)} neste período; eles continuam na agenda e precisam ser remarcados ou cancelados.`
                );
                setForm(formInicial(dia, profissionalId));
                void carregarProximos();
            } else {
                onClose();
            }
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const excluir = async (b: Bloqueio) => {
        setExcluindo(b.id);
        setErro('');
        try {
            await bloqueioService.excluir(b.id);
            onAlterado();
            if (selecionado) {
                onClose();
            } else {
                setProximos((lista) => lista.filter((x) => x.id !== b.id));
            }
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setExcluindo(null);
        }
    };

    const fechar = () => {
        if (ocupado) return;
        onClose();
    };

    if (selecionado) {
        return (
            <Modal
                aberto={aberto}
                titulo={selecionado.motivo ?? 'Horário bloqueado'}
                eyebrow="Bloqueio"
                subtitulo={`${selecionado.profissionalNome ?? 'Empresa toda'} · ${descreverPeriodo(selecionado)}`}
                onClose={fechar}
                largura="28rem"
                rodape={
                    <>
                        <Button variant="ghost" onClick={fechar} disabled={ocupado}>
                            Fechar
                        </Button>
                        <Button variant="danger" onClick={() => void excluir(selecionado)} disabled={ocupado}>
                            {excluindo ? 'Removendo…' : 'Remover bloqueio'}
                        </Button>
                    </>
                }
            >
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {`Enquanto o bloqueio existir, não é possível marcar ${termos.varios('agendamento')} neste período.`}
                </p>
                {erro && (
                    <div className="mt-3">
                        <Alert titulo={tituloDeMensagem(erro)}>{erro}</Alert>
                    </div>
                )}
            </Modal>
        );
    }

    return (
        <Modal
            aberto={aberto}
            titulo="Bloquear horário"
            eyebrow="Agenda"
            subtitulo="Férias, feriados, folgas ou compromissos. Ninguém consegue marcar no período bloqueado."
            onClose={fechar}
            largura="34rem"
            rodape={
                <>
                    <Button variant="ghost" onClick={fechar} disabled={ocupado}>
                        Fechar
                    </Button>
                    <Button onClick={() => void salvar()} disabled={ocupado || !periodoValido}>
                        {salvando ? 'Salvando…' : 'Bloquear'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <label className="block w-full">
                    <span className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        Para quem
                    </span>
                    <select
                        className="lyra-input"
                        style={{ marginTop: 0 }}
                        value={form.profissionalId}
                        onChange={(e) => patch({ profissionalId: e.target.value })}
                        disabled={ocupado}
                    >
                        <option value="">Empresa toda</option>
                        {profissionais.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.nome}
                            </option>
                        ))}
                    </select>
                </label>

                <Switch
                    label="Dia inteiro"
                    descricao="Desligue para bloquear só algumas horas."
                    checked={form.diaInteiro}
                    disabled={ocupado}
                    onChange={(diaInteiro) => patch({ diaInteiro })}
                />

                {form.diaInteiro ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="De"
                            type="date"
                            required
                            value={form.dataInicio}
                            onChange={(e) => {
                                const dataInicio = e.target.value;
                                patch(dataInicio > form.dataFim ? { dataInicio, dataFim: dataInicio } : { dataInicio });
                            }}
                        />
                        <Input
                            label="Até"
                            type="date"
                            required
                            min={form.dataInicio}
                            value={form.dataFim}
                            onChange={(e) => patch({ dataFim: e.target.value })}
                        />
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Início"
                            type="datetime-local"
                            required
                            step={900}
                            value={form.inicio}
                            onChange={(e) => patch({ inicio: e.target.value })}
                        />
                        <Input
                            label="Fim"
                            type="datetime-local"
                            required
                            step={900}
                            value={form.fim}
                            onChange={(e) => patch({ fim: e.target.value })}
                        />
                    </div>
                )}

                <Input
                    label="Motivo"
                    placeholder="Férias, feriado, reunião…"
                    maxLength={200}
                    value={form.motivo}
                    onChange={(e) => patch({ motivo: e.target.value })}
                />

                {aviso && (
                    <Alert titulo="Atenção" variant="warn">
                        {aviso}
                    </Alert>
                )}
                {erro && <Alert titulo={tituloDeMensagem(erro)}>{erro}</Alert>}

                <div>
                    <p
                        className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]"
                        style={{ color: 'var(--copper)' }}
                    >
                        Próximos bloqueios
                    </p>
                    {carregando && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Carregando…
                        </p>
                    )}
                    {!carregando && proximos.length === 0 && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Nenhum bloqueio nos próximos meses.
                        </p>
                    )}
                    <div className="flex flex-col gap-2">
                        {proximos.map((b) => (
                            <div
                                key={b.id}
                                className="flex items-center gap-3 rounded-lyra border px-3 py-2"
                                style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                        {b.motivo ?? 'Bloqueado'}
                                    </p>
                                    <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        {b.profissionalNome ?? 'Empresa toda'} · {descreverPeriodo(b)}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={ocupado}
                                    onClick={() => void excluir(b)}
                                >
                                    {excluindo === b.id ? 'Removendo…' : 'Remover'}
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
