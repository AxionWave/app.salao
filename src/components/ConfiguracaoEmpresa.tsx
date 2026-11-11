import { useEffect, useMemo, useState } from 'react';
import PageCard from '@/components/layout/PageCard';
import { Alert, Button, Input, Switch } from '@/components/ui';
import { mensagemErroHttp, tituloDeMensagem } from '@/exceptions';
import { useConfiguracaoEmpresa } from '@/contexts/TermosContext';
import {
    configuracaoService,
    type ChaveTermo,
    type Genero,
    type OpcoesConfiguracao,
    type Terminologia,
} from '@/services/configuracao.service';

const CONCEITOS: { chave: ChaveTermo; nome: string; dica: string }[] = [
    { chave: 'recurso', nome: 'Quem atende', dica: 'Profissional, instrutor, espaço…' },
    { chave: 'servico', nome: 'O que se agenda', dica: 'Serviço, procedimento, aula…' },
    { chave: 'cliente', nome: 'Quem é atendido', dica: 'Cliente, paciente, aluno…' },
    { chave: 'agendamento', nome: 'Item da agenda', dica: 'Horário, consulta, reserva…' },
];

const LEMBRETES: { horas: number; nome: string }[] = [
    { horas: 24, nome: '1 dia antes' },
    { horas: 2, nome: '2 horas antes' },
];

function iguais(a: Terminologia, b: Terminologia): boolean {
    return CONCEITOS.every(({ chave }) => {
        const x = a[chave];
        const y = b[chave];
        return x.singular === y.singular && x.plural === y.plural && x.genero === y.genero;
    });
}

export default function ConfiguracaoEmpresa() {
    const { aplicar } = useConfiguracaoEmpresa();
    const [opcoes, setOpcoes] = useState<OpcoesConfiguracao | null>(null);
    const [segmento, setSegmento] = useState('');
    const [fuso, setFuso] = useState('');
    const [terminologia, setTerminologia] = useState<Terminologia | null>(null);
    const [personalizar, setPersonalizar] = useState(false);
    const [enviarEmails, setEnviarEmails] = useState(false);
    const [lembretes, setLembretes] = useState<number[]>([]);
    const [resumoDiario, setResumoDiario] = useState(false);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState('');
    const [salvoEm, setSalvoEm] = useState<Date | null>(null);

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                const [ops, cfg] = await Promise.all([configuracaoService.opcoes(), configuracaoService.obter()]);
                if (!vivo) return;
                setOpcoes(ops);
                setSegmento(cfg.segmento);
                setFuso(cfg.fusoHorario);
                setTerminologia(cfg.terminologia);
                setPersonalizar(cfg.personalizada);
                setEnviarEmails(cfg.enviarEmails);
                setLembretes(cfg.lembretesHoras ?? []);
                setResumoDiario(cfg.resumoDiario ?? false);
            } catch (e) {
                if (vivo) setErro(mensagemErroHttp(e));
            } finally {
                if (vivo) setCarregando(false);
            }
        })();
        return () => {
            vivo = false;
        };
    }, []);

    const padraoDoSegmento = useMemo(
        () => opcoes?.segmentos.find((s) => s.id === segmento)?.terminologia ?? null,
        [opcoes, segmento]
    );

    const escolherSegmento = (id: string) => {
        setSegmento(id);
        setSalvoEm(null);
        const preset = opcoes?.segmentos.find((s) => s.id === id)?.terminologia;
        if (preset && !personalizar) setTerminologia(preset);
    };

    const alternarPersonalizar = (v: boolean) => {
        setPersonalizar(v);
        setSalvoEm(null);
        if (!v && padraoDoSegmento) setTerminologia(padraoDoSegmento);
    };

    const editarTermo = (chave: ChaveTermo, campo: 'singular' | 'plural' | 'genero', valor: string) => {
        setSalvoEm(null);
        setTerminologia((t) => (t ? { ...t, [chave]: { ...t[chave], [campo]: valor } } : t));
    };

    const salvar = async () => {
        if (!terminologia) return;
        setSalvando(true);
        setErro('');
        try {
            const usarPersonalizada =
                personalizar && !(padraoDoSegmento && iguais(terminologia, padraoDoSegmento));
            const cfg = await configuracaoService.salvar({
                segmento,
                fusoHorario: fuso,
                terminologia: usarPersonalizada ? terminologia : null,
                enviarEmails,
                lembretesHoras: lembretes,
                resumoDiario,
            });
            aplicar(cfg);
            setTerminologia(cfg.terminologia);
            setPersonalizar(cfg.personalizada);
            setEnviarEmails(cfg.enviarEmails);
            setLembretes(cfg.lembretesHoras ?? []);
            setResumoDiario(cfg.resumoDiario ?? false);
            setSalvoEm(new Date());
        } catch (e) {
            setErro(mensagemErroHttp(e));
        } finally {
            setSalvando(false);
        }
    };

    const t = terminologia;
    const previa = t
        ? `Menu: ${t.recurso.plural} · ${t.servico.plural} · ${t.cliente.plural} — botão da agenda: «${
              t.agendamento.genero === 'f' ? 'Nova' : 'Novo'
          } ${t.agendamento.singular.toLocaleLowerCase('pt-BR')}»`
        : '';

    return (
        <PageCard fill={false}>
            <div className="p-5 md:p-6">
                <div className="mb-4 flex flex-col gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--copper)' }}>
                        Empresa
                    </p>
                    <h2 className="font-display text-lg font-semibold">Tipo de negócio</h2>
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Define os nomes que aparecem no Lyra (menu, agenda, cadastros) e o fuso horário da agenda.
                    </p>
                </div>

                {erro && (
                    <div className="mb-4">
                        <Alert titulo={tituloDeMensagem(erro)}>{erro}</Alert>
                    </div>
                )}

                {carregando && (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                        Carregando configuração…
                    </p>
                )}

                {!carregando && opcoes && t && (
                    <div className="flex flex-col gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                Segmento
                                <select
                                    className="lyra-input"
                                    value={segmento}
                                    disabled={salvando}
                                    onChange={(e) => escolherSegmento(e.target.value)}
                                >
                                    {opcoes.segmentos.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.nome}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                Fuso horário
                                <select
                                    className="lyra-input"
                                    value={fuso}
                                    disabled={salvando}
                                    onChange={(e) => {
                                        setFuso(e.target.value);
                                        setSalvoEm(null);
                                    }}
                                >
                                    {opcoes.fusosHorarios.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.nome}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <Switch
                            label="Personalizar nomes"
                            descricao="Use outros nomes além do padrão do segmento."
                            checked={personalizar}
                            disabled={salvando}
                            onChange={alternarPersonalizar}
                        />

                        {personalizar && (
                            <div className="flex flex-col gap-3">
                                {CONCEITOS.map(({ chave, nome, dica }) => (
                                    <div
                                        key={chave}
                                        className="rounded-lyra border px-4 py-3"
                                        style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
                                    >
                                        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                            {nome}
                                            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>
                                                {dica}
                                            </span>
                                        </p>
                                        <div className="mt-2 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
                                            <Input
                                                label="Singular"
                                                value={t[chave].singular}
                                                maxLength={40}
                                                disabled={salvando}
                                                onChange={(e) => editarTermo(chave, 'singular', e.target.value)}
                                            />
                                            <Input
                                                label="Plural"
                                                value={t[chave].plural}
                                                maxLength={40}
                                                disabled={salvando}
                                                onChange={(e) => editarTermo(chave, 'plural', e.target.value)}
                                            />
                                            <label className="block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                                                <span className="mb-1.5 block">Gênero</span>
                                                <select
                                                    className="lyra-input"
                                                    style={{ marginTop: 0 }}
                                                    value={t[chave].genero}
                                                    disabled={salvando}
                                                    onChange={(e) => editarTermo(chave, 'genero', e.target.value as Genero)}
                                                >
                                                    <option value="m">Masculino</option>
                                                    <option value="f">Feminino</option>
                                                </select>
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                            <Switch
                                label={`Avisar ${t.cliente.plural.toLocaleLowerCase('pt-BR')} por e-mail`}
                                descricao="Quem tiver e-mail no cadastro recebe a confirmação ao marcar, remarcar ou cancelar, com o convite para a agenda do celular e um botão para confirmar presença. O remetente é o nome da empresa e as respostas vão para o e-mail do cadastro dela."
                                checked={enviarEmails}
                                disabled={salvando}
                                onChange={(v) => {
                                    setEnviarEmails(v);
                                    setSalvoEm(null);
                                }}
                            />
                            {enviarEmails && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
                                    <span className="text-sm" style={{ color: 'var(--ink)' }}>
                                        Lembrete:
                                    </span>
                                    {LEMBRETES.map(({ horas, nome }) => {
                                        const ligado = lembretes.includes(horas);
                                        return (
                                            <button
                                                key={horas}
                                                type="button"
                                                aria-pressed={ligado}
                                                disabled={salvando}
                                                onClick={() => {
                                                    setLembretes((atual) =>
                                                        ligado ? atual.filter((h) => h !== horas) : [...atual, horas]
                                                    );
                                                    setSalvoEm(null);
                                                }}
                                                className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                                                style={
                                                    ligado
                                                        ? { borderColor: 'var(--copper)', background: 'var(--copper)', color: '#fff' }
                                                        : { borderColor: 'var(--line)', background: 'transparent', color: 'var(--muted-foreground)' }
                                                }
                                            >
                                                {ligado ? '✓ ' : ''}
                                                {nome}
                                            </button>
                                        );
                                    })}
                                    <span className="w-full text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        {lembretes.length === 0
                                            ? 'Sem lembrete antes do horário.'
                                            : 'Sai só para quem ainda tem o horário de pé. Quem marcou em cima da hora não recebe lembrete repetido.'}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="border-t pt-4" style={{ borderColor: 'var(--line)' }}>
                            <Switch
                                label={`Resumo do dia para ${t.recurso.plural.toLocaleLowerCase('pt-BR')}`}
                                descricao={`Às 7h, cada ${t.recurso.singular.toLocaleLowerCase('pt-BR')} com ${t.agendamento.plural.toLocaleLowerCase('pt-BR')} no dia recebe a lista por e-mail, com um botão para abrir a agenda. Vale o e-mail de login da pessoa no cadastro.`}
                                checked={resumoDiario}
                                disabled={salvando}
                                onChange={(v) => {
                                    setResumoDiario(v);
                                    setSalvoEm(null);
                                }}
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                {previa}
                            </p>
                            <div className="flex items-center gap-3">
                                {salvoEm && (
                                    <span className="text-xs" style={{ color: 'var(--ok)' }}>
                                        Salvo
                                    </span>
                                )}
                                <Button onClick={() => void salvar()} disabled={salvando}>
                                    {salvando ? 'Salvando…' : 'Salvar'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageCard>
    );
}
