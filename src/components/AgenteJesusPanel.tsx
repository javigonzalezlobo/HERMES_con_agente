import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Brain,
  Send,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  CheckCircle2,
  Trash2,
  Upload,
  RotateCcw,
  Play,
  Copy,
  Check,
  FileJson,
  Activity,
  Flame,
  Gauge,
  ChevronDown,
  ChevronUp,
  WifiOff,
  Loader2,
  Rocket,
  DownloadCloud,
  Sliders,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MotorInput,
  NozzleInput,
  GrainInput,
  CustomPropellant,
  SimulationResults,
  getPropellantData,
} from '../lib/types';
import { ApogeeResult } from '../lib/apogee';
import {
  AgenteJesusConfig,
  AgenteChatMessage,
  AVAILABLE_AGENT_MODELS,
  isAgenteJesusActivated,
  setAgenteJesusActivated,
  isContextWindowEnabled,
  setContextWindowEnabled,
  loadSelectedModelId,
  saveSelectedModelId,
  loadAgenteJesusConfig,
  saveCustomAgenteJesusConfig,
  clearCustomAgenteJesusConfig,
  resetAgenteJesusConfigToDefault,
  parseAgenteContextText,
  loadAgenteChatHistory,
  saveAgenteChatHistory,
  clearAgenteChatHistory,
  loadMaxSafePressureBar,
  saveMaxSafePressureBar,
  buildSimulationContextPayload,
  buildSimulationSnapshotLabel,
  extractInputProposalFromText,
  sendChatToAgenteJesus,
} from '../lib/agenteJesus';

interface AgenteJesusPanelProps {
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  results: SimulationResults | null;
  simApogee: ApogeeResult | null;
  expApogee: ApogeeResult | null;
  lang: string;
  theme: 'dark' | 'light';
  onRunSimulation: () => void;
  onApplyConfiguration: (
    nextMotor: MotorInput,
    nextNozzle: NozzleInput,
    nextGrains: GrainInput[],
    runSim: boolean
  ) => SimulationResults | null;
  onNavigateTab?: (tab: string) => void;
  onActivationChange?: (activated: boolean) => void;
}

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-muted text-amber-700 dark:text-amber-300 font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedMessageContent({ content }: { content: string }) {
  const blocks = useMemo(() => {
    const lines = content.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        nodes.push(
          <pre
            key={`code-${i}`}
            className="my-2 p-2.5 rounded-lg bg-slate-950 text-slate-100 border border-slate-800 font-mono text-[11px] overflow-x-auto"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        continue;
      }

      if (
        line.trim().startsWith('|') &&
        i + 1 < lines.length &&
        /^\|[\s:|-]+\|/.test(lines[i + 1].trim())
      ) {
        const headerCells = line
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          rows.push(
            lines[i]
              .trim()
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim())
          );
          i++;
        }
        nodes.push(
          <div key={`tbl-${i}`} className="my-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-muted/70">
                <tr>
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className="text-left px-2.5 py-1.5 font-semibold border-b border-border"
                    >
                      {renderInlineFormatting(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, rIdx) => (
                  <tr key={rIdx} className="border-b border-border/60 last:border-none">
                    {r.map((cell, cIdx) => (
                      <td key={cIdx} className="px-2.5 py-1.5 font-mono text-[11px]">
                        {renderInlineFormatting(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];
        nodes.push(
          <div
            key={`h-${i}`}
            className={`font-bold text-amber-700 dark:text-amber-300 mt-3 mb-1 ${
              level <= 2 ? 'text-sm' : 'text-xs uppercase tracking-wider'
            }`}
          >
            {renderInlineFormatting(title)}
          </div>
        );
        i++;
        continue;
      }

      if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        const items: { ordered: boolean; text: string }[] = [];
        while (
          i < lines.length &&
          (/^\s*[-*•]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))
        ) {
          const ordered = /^\s*\d+\.\s+/.test(lines[i]);
          const clean = lines[i].replace(/^\s*(?:[-*•]|\d+\.)\s+/, '');
          items.push({ ordered, text: clean });
          i++;
        }
        nodes.push(
          <ul key={`list-${i}`} className="my-1.5 space-y-1 pl-4">
            {items.map((item, idx) => (
              <li
                key={idx}
                className={
                  item.ordered ? 'list-decimal leading-relaxed' : 'list-disc leading-relaxed'
                }
              >
                {renderInlineFormatting(item.text)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      if (!line.trim()) {
        nodes.push(<div key={`sp-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      nodes.push(
        <p key={`p-${i}`} className="leading-relaxed">
          {renderInlineFormatting(line)}
        </p>
      );
      i++;
    }
    return nodes;
  }, [content]);

  return <div className="text-xs sm:text-[13px] space-y-0.5 break-words">{blocks}</div>;
}

export const AgenteJesusPanel: React.FC<AgenteJesusPanelProps> = ({
  motor,
  nozzle,
  grains,
  customPropellants,
  results,
  simApogee,
  expApogee,
  lang,
  theme,
  onRunSimulation,
  onApplyConfiguration,
  onNavigateTab,
  onActivationChange,
}) => {
  const isEs = lang !== 'en';
  const isLight = theme === 'light';

  const [activated, setActivated] = useState<boolean>(() => isAgenteJesusActivated());
  const [configState, setConfigState] = useState<{
    config: AgenteJesusConfig;
    isCustom: boolean;
  }>(() => loadAgenteJesusConfig());
  const [contextEnabled, setContextEnabled] = useState<boolean>(() =>
    isContextWindowEnabled()
  );
  const [selectedModelId, setSelectedModelId] = useState<string>(() =>
    loadSelectedModelId(loadAgenteJesusConfig().config.model_name)
  );
  const [messages, setMessages] = useState<AgenteChatMessage[]>(() =>
    loadAgenteChatHistory()
  );
  const [maxPressureStr, setMaxPressureStr] = useState<string>(() =>
    loadMaxSafePressureBar()
  );
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTelemetryJson, setShowTelemetryJson] = useState(false);
  const [showContextSidebar, setShowContextSidebar] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [configNotice, setConfigNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const maxSafePressureBar = useMemo(() => {
    const parsed = parseFloat(maxPressureStr);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [maxPressureStr]);

  const simContext = useMemo(
    () => ({
      motor,
      nozzle,
      grains,
      customPropellants,
      results,
      simApogee,
      expApogee,
      maxSafePressureBar,
    }),
    [
      motor,
      nozzle,
      grains,
      customPropellants,
      results,
      simApogee,
      expApogee,
      maxSafePressureBar,
    ]
  );

  const snapshotLabel = useMemo(
    () => buildSimulationSnapshotLabel(simContext),
    [simContext]
  );

  const telemetryPayloadPreview = useMemo(() => {
    if (!showTelemetryJson) return '';
    return JSON.stringify(buildSimulationContextPayload(simContext), null, 2);
  }, [showTelemetryJson, simContext]);

  useEffect(() => {
    saveAgenteChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    saveMaxSafePressureBar(maxPressureStr);
  }, [maxPressureStr]);

  useEffect(() => {
    saveSelectedModelId(selectedModelId);
  }, [selectedModelId]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const firstPropellant = grains[0]
    ? getPropellantData(grains[0].propellantType, customPropellants)
    : null;

  const pMaxBar = results ? results.summary.Pmax_MPa * 10 : null;
  const isOverUserPressureLimit =
    pMaxBar !== null &&
    maxSafePressureBar !== null &&
    pMaxBar > maxSafePressureBar;

  const modelOptions = useMemo(() => {
    const list = [...AVAILABLE_AGENT_MODELS];
    if (
      configState.isCustom &&
      configState.config.model_name &&
      !list.some((m) => m.id === configState.config.model_name)
    ) {
      list.unshift({
        id: configState.config.model_name,
        label: configState.config.model_name,
        tag: 'JSON',
      });
    }
    return list;
  }, [configState]);

  const handleActivateAgent = () => {
    setAgenteJesusActivated(true);
    setActivated(true);
    onActivationChange?.(true);

    if (messages.length === 0) {
      const welcomeMsg: AgenteChatMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        timestamp: Date.now(),
        modelUsed: selectedModelId,
        simSnapshotLabel: snapshotLabel,
        content: isEs
          ? `**Agente Jesús activado y conectado a la telemetría de HERMES.**\n\nRecibo automáticamente todos los **inputs** y **resultados** de tus simulaciones. También puedes pedirme que **modifique parámetros o recomiende una configuración mejorada** (respetando las restricciones que me indiques) para aplicarla y simularla con un clic.\n\n- **Motor cargado:** Dc = \`${motor.Dc} mm\`, Lc = \`${motor.Lc} mm\`, Propulsante \`${firstPropellant?.name || 'N/A'}\`, Garganta Dt0 = \`${nozzle.Dt0} mm\`.\n- **Estado:** ${
              results
                ? `Simulación activa (**Clase ${results.summary.motorClass}**, Pmax = \`${(
                    results.summary.Pmax_MPa * 10
                  ).toFixed(2)} bar\`, It = \`${results.summary.It_total_N_s.toFixed(
                    1
                  )} N·s\`).`
                : 'Sin simulación ejecutada todavía. Puedes pulsar **"Simular y Sincronizar Datos"** o pedirme cambios directamente.'
            }\n\nAntes de empezar: **¿cuál es la presión máxima de diseño segura (en bar) para tu carcasa y qué medidas de seguridad implementas en el banco?**`
          : `**Agente Jesús activated and linked to HERMES live telemetry.**\n\nI automatically receive all **inputs** and **simulation results**. You can also ask me to **modify parameters or recommend an improved configuration** (respecting any constraints you specify) and apply + simulate it in one click.\n\n- **Loaded motor:** Dc = \`${motor.Dc} mm\`, Lc = \`${motor.Lc} mm\`, Propellant \`${firstPropellant?.name || 'N/A'}\`, Throat Dt0 = \`${nozzle.Dt0} mm\`.\n- **Status:** ${
              results
                ? `Active simulation (**Class ${results.summary.motorClass}**, Pmax = \`${(
                    results.summary.Pmax_MPa * 10
                  ).toFixed(2)} bar\`, It = \`${results.summary.It_total_N_s.toFixed(
                    1
                  )} N·s\`).`
                : 'No simulation run yet. Click **"Run & Sync Simulation"** or ask for parameter changes directly.'
            }\n\nBefore starting: **what is your maximum safe chamber pressure (in bar) and what safety measures are in place on the test stand?**`,
      };
      setMessages([welcomeMsg]);
    }
  };

  const handleImportContextFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseAgenteContextText(text);
      saveCustomAgenteJesusConfig(parsed);
      setContextWindowEnabled(true);
      setContextEnabled(true);
      setConfigState({ config: parsed, isCustom: true });
      setConfigNotice(
        isEs
          ? `Contexto "${file.name}" cargado (${
              parsed.knowledge_base?.conocimiento_y_ensayos?.historial_ensayos
                ?.length || 0
            } ensayos).`
          : `Context "${file.name}" loaded.`
      );
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (isEs
            ? 'No se pudo leer el archivo JSON/TXT de contexto.'
            : 'Could not parse context JSON/TXT file.')
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveContextWindow = () => {
    clearCustomAgenteJesusConfig();
    setContextWindowEnabled(false);
    setContextEnabled(false);
    setConfigState((prev) => ({ config: prev.config, isCustom: false }));
    setConfigNotice(
      isEs
        ? 'Ventana de contexto quitada. El agente responde sin base de ensayos ni prompt personalizado.'
        : 'Context window removed. Agent replies without custom prompt or test database.'
    );
  };

  const handleRestoreDefaultConfig = () => {
    const def = resetAgenteJesusConfigToDefault();
    setContextEnabled(true);
    setConfigState({ config: def, isCustom: false });
    setConfigNotice(
      isEs
        ? 'Ventana de contexto original restaurada.'
        : 'Default context window restored.'
    );
  };

  const handleSendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText ?? inputText).trim();
    if (!textToSend || isLoading) return;

    const userMsg: AgenteChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      simSnapshotLabel: snapshotLabel,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!overrideText) setInputText('');
    setIsLoading(true);
    setErrorMsg(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await sendChatToAgenteJesus({
        config: configState.config,
        selectedModelId,
        contextEnabled,
        messages: nextMessages,
        simContext,
        lang,
        signal: controller.signal,
      });

      const assistantMsg: AgenteChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: Date.now(),
        modelUsed: res.modelUsed,
        simSnapshotLabel: snapshotLabel,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const msg =
        err?.message ||
        (isEs
          ? 'No se pudo conectar con el modelo de IA.'
          : 'Could not connect to AI model.');
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyProposal = (
    messageId: string,
    nextMotor: MotorInput,
    nextNozzle: NozzleInput,
    nextGrains: GrainInput[],
    runSim: boolean
  ) => {
    const simRes = onApplyConfiguration(nextMotor, nextNozzle, nextGrains, runSim);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              appliedInputs: true,
              ...(runSim && simRes
                ? {
                    appliedSummary: {
                      motorClass: simRes.summary.motorClass,
                      pMaxBar: simRes.summary.Pmax_MPa * 10,
                      fMaxN: simRes.summary.Fmax_N,
                      itNs: simRes.summary.It_total_N_s,
                      ispS: simRes.summary.Isp_total_s,
                      tbS: simRes.summary.t_quemado,
                    },
                  }
                : {}),
            }
          : m
      )
    );
  };

  const handleCopyMessage = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {}
  };

  const handleClearChat = () => {
    clearAgenteChatHistory();
    setMessages([]);
    setErrorMsg(null);
  };

  const ensayosCount = contextEnabled
    ? configState.config.knowledge_base?.conocimiento_y_ensayos?.historial_ensayos
        ?.length || 0
    : 0;

  // ── ACTIVATION SCREEN ──
  if (!activated) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex items-start lg:items-center justify-center p-1">
      <div
        className={`max-w-4xl mx-auto w-full rounded-2xl border p-6 md:p-8 transition-all shadow-lg ${
          isLight
            ? 'bg-gradient-to-br from-amber-50/90 via-white to-stone-50 border-amber-500/40 text-stone-900'
            : 'bg-gradient-to-br from-amber-950/25 via-slate-900/95 to-slate-950 border-amber-500/40 text-slate-100'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt"
          className="hidden"
          onChange={handleImportContextFile}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-amber-500/25">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/35 shadow-inner">
              <Bot size={28} />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {isEs
                  ? 'Módulo Opcional • Activación Permanente'
                  : 'Optional Module • One-Time Activation'}
              </span>
              <h2 className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1.5 flex items-center gap-2">
                <Brain size={22} />
                {isEs
                  ? 'Agente Jesús / Ingeniero Experto en Cohetería'
                  : 'Agente Jesús / Rocket Propulsion Expert'}
              </h2>
            </div>
          </div>

          <Button
            onClick={handleActivateAgent}
            size="lg"
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-[0_0_20px_rgba(245,158,11,0.35)] gap-2 cursor-pointer"
          >
            <DownloadCloud size={18} />
            {isEs ? 'Activar Agente Jesús' : 'Activate Agente Jesús'}
          </Button>
        </div>

        <div className="mt-6 space-y-5 text-sm leading-relaxed">
          <div
            className={`p-4 rounded-xl border ${
              isLight
                ? 'bg-white/90 border-amber-200 text-stone-800'
                : 'bg-slate-900/80 border-amber-500/20 text-slate-200'
            }`}
          >
            <h3 className="font-bold text-amber-700 dark:text-amber-400 text-base mb-1.5 flex items-center gap-2">
              <Sparkles size={18} />
              {isEs
                ? 'Conectado automáticamente a tus inputs, resultados y simulaciones'
                : 'Automatically connected to inputs, results, and simulations'}
            </h3>
            <p className="text-muted-foreground">
              {isEs
                ? 'Una vez activado, permanecerá habilitado para siempre aunque cierres y reinicies HERMES. Recibe todos los parámetros y resultados de cada simulación, y puede proponerte nuevas configuraciones para aplicarlas y simularlas directamente con un clic.'
                : 'Once activated, it stays enabled permanently across app restarts. It receives all parameters and results of each simulation and can propose updated configurations that you can apply and simulate in one click.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`p-4 rounded-xl border flex gap-3 ${
                isLight
                  ? 'bg-white/80 border-amber-200'
                  : 'bg-slate-900/70 border-amber-500/20'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Activity size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-700 dark:text-amber-300 mb-1">
                  {isEs ? 'Telemetría Completa Automática' : 'Automatic Full Telemetry'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isEs
                    ? 'Inyecta presiones, empuje, Kn, velocidad de quemado, flujos másicos y geometría sin que tengas que copiar datos.'
                    : 'Streams pressure, thrust, Kn, burn rate, mass flow, and geometry automatically.'}
                </p>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border flex gap-3 ${
                isLight
                  ? 'bg-white/80 border-amber-200'
                  : 'bg-slate-900/70 border-amber-500/20'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Sliders size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-700 dark:text-amber-300 mb-1">
                  {isEs ? 'Ajuste Asistido de Inputs' : 'Assisted Input Tuning'}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isEs
                    ? 'Pídele mejoras respetando tus restricciones y aplica la configuración recomendada a los inputs con simulación instantánea.'
                    : 'Ask for improvements under your constraints and apply recommended configs to inputs with instant simulation.'}
                </p>
              </div>
            </div>
          </div>

          {configNotice && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono">
              {configNotice}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-mono">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 text-xs cursor-pointer"
              >
                <Upload size={14} />
                {isEs ? 'Cargar JSON/TXT' : 'Load JSON/TXT'}
              </Button>
              {contextEnabled ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveContextWindow}
                  className="gap-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 size={14} />
                  {isEs ? 'Quitar Context Window' : 'Remove Context Window'}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestoreDefaultConfig}
                  className="gap-1.5 text-xs cursor-pointer"
                >
                  <RotateCcw size={14} />
                  {isEs ? 'Restaurar Contexto' : 'Restore Context'}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <ShieldCheck size={14} className="text-amber-500" />
              <span>
                {contextEnabled
                  ? `${ensayosCount} ${isEs ? 'ensayos en contexto' : 'test firings loaded'}`
                  : isEs
                    ? 'Sin Context Window'
                    : 'No Context Window'}
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    );
  }

  // ── ACTIVATED CHAT WORKSPACE ──
  return (
    <div className="flex-1 min-h-0 h-full flex flex-col lg:grid lg:grid-cols-12 gap-3 overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.txt"
        className="hidden"
        onChange={handleImportContextFile}
      />

      {/* LEFT SIDEBAR */}
      <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-2.5 shrink-0 lg:shrink lg:min-h-0 lg:h-full max-h-[38vh] lg:max-h-none overflow-y-auto pr-0.5">
        <div className="lg:hidden flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card">
          <span className="text-xs font-bold flex items-center gap-2">
            <Activity size={14} className="text-amber-500" />
            {isEs ? 'Telemetría y Contexto' : 'Telemetry & Context'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setShowContextSidebar((v) => !v)}
          >
            {showContextSidebar ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </Button>
        </div>

        <div
          className={`${
            showContextSidebar ? 'flex' : 'hidden'
          } lg:flex flex-col gap-2.5`}
        >
          {/* Live Simulation Telemetry Card */}
          <div
            className={`rounded-xl border p-3.5 shadow-xs ${
              isLight ? 'bg-white border-[#e4dfd5]' : 'bg-card border-border'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-amber-500 shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  {isEs ? 'Telemetría Conectada' : 'Live Telemetry'}
                </h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  results
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                }`}
              >
                {results
                  ? isEs
                    ? 'Simulación Lista'
                    : 'Sim Ready'
                  : isEs
                    ? 'Solo Inputs'
                    : 'Inputs Only'}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between gap-2 py-1 border-b border-border/60">
                <span className="text-muted-foreground">Propulsante</span>
                <span className="font-semibold text-right truncate max-w-[150px]">
                  {firstPropellant?.name || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between gap-2 py-1 border-b border-border/60">
                <span className="text-muted-foreground">Cámara (Dc × Lc)</span>
                <span className="font-semibold">
                  {motor.Dc} × {motor.Lc} mm
                </span>
              </div>
              <div className="flex justify-between gap-2 py-1 border-b border-border/60">
                <span className="text-muted-foreground">Tobera (Dt0 / Ds)</span>
                <span className="font-semibold">
                  {nozzle.Dt0} / {nozzle.Ds} mm
                </span>
              </div>
              <div className="flex justify-between gap-2 py-1 border-b border-border/60">
                <span className="text-muted-foreground">Granos</span>
                <span className="font-semibold">
                  {grains.reduce((a, g) => a + (g.N || 0), 0)} seg ({grains.length}{' '}
                  {grains.length === 1 ? 'tipo' : 'tipos'})
                </span>
              </div>

              {results ? (
                <>
                  <div className="flex justify-between gap-2 py-1 border-b border-border/60">
                    <span className="text-muted-foreground">Clase / tb</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">
                      {results.summary.motorClass} •{' '}
                      {results.summary.t_quemado.toFixed(2)} s
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-1 border-b border-border/60">
                    <span className="text-muted-foreground">Pmax</span>
                    <span
                      className={`font-bold ${
                        isOverUserPressureLimit
                          ? 'text-red-500'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {(results.summary.Pmax_MPa * 10).toFixed(2)} bar (
                      {results.summary.Pmax_MPa.toFixed(2)} MPa)
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-1 border-b border-border/60">
                    <span className="text-muted-foreground">Fmax / It</span>
                    <span className="font-semibold">
                      {results.summary.Fmax_N.toFixed(0)} N •{' '}
                      {results.summary.It_total_N_s.toFixed(0)} N·s
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-1">
                    <span className="text-muted-foreground">Isp / Kn max</span>
                    <span className="font-semibold">
                      {results.summary.Isp_total_s.toFixed(1)} s •{' '}
                      {(results.summary.Kn_max || 0).toFixed(0)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="pt-2">
                  <Button
                    onClick={onRunSimulation}
                    size="sm"
                    className="w-full h-8 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white gap-1.5 cursor-pointer"
                  >
                    <Play size={13} />
                    {isEs ? 'Simular y Sincronizar Datos' : 'Run & Sync Simulation'}
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-2.5 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setShowTelemetryJson((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <FileJson size={13} className="text-amber-500" />
                  {isEs
                    ? 'Ver JSON enviado al agente'
                    : 'Inspect JSON sent to agent'}
                </span>
                {showTelemetryJson ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showTelemetryJson && (
                <pre className="mt-2 max-h-48 overflow-auto p-2 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 text-[10px] font-mono leading-snug">
                  {telemetryPayloadPreview}
                </pre>
              )}
            </div>
          </div>

          {/* Safety Threshold Card */}
          <div
            className={`rounded-xl border p-3.5 shadow-xs ${
              isOverUserPressureLimit
                ? 'bg-red-500/10 border-red-500/50'
                : isLight
                  ? 'bg-white border-[#e4dfd5]'
                  : 'bg-card border-border'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Gauge
                size={15}
                className={isOverUserPressureLimit ? 'text-red-500' : 'text-amber-500'}
              />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isEs ? 'Límite de Seguridad' : 'Safety Threshold'}
              </h3>
            </div>
            <label className="block text-[11px] text-muted-foreground mb-1.5">
              {isEs
                ? 'Presión máxima admisible de carcasa [bar]:'
                : 'Max allowable chamber pressure [bar]:'}
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={1}
                placeholder={isEs ? 'Ej. 65' : 'E.g. 65'}
                value={maxPressureStr}
                onChange={(e) => setMaxPressureStr(e.target.value)}
                className="h-8 text-xs font-mono"
              />
              <span className="text-xs font-mono font-bold text-muted-foreground">
                bar
              </span>
            </div>
            {isOverUserPressureLimit && pMaxBar !== null && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400 font-semibold">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span>
                  {isEs
                    ? `¡ALERTA! Pmax (${pMaxBar.toFixed(1)} bar) supera el límite (${maxSafePressureBar} bar).`
                    : `ALERT! Pmax (${pMaxBar.toFixed(1)} bar) exceeds limit (${maxSafePressureBar} bar).`}
                </span>
              </div>
            )}
          </div>

          {/* Model & Removable Context Window Card */}
          <div
            className={`rounded-xl border p-3.5 shadow-xs ${
              isLight ? 'bg-white border-[#e4dfd5]' : 'bg-card border-border'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-purple-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Context Window
                </h3>
              </div>
              {contextEnabled ? (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={11} />
                  {isEs ? 'Cargado' : 'Loaded'}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground font-bold flex items-center gap-1">
                  <XCircle size={11} />
                  {isEs ? 'Quitado' : 'Removed'}
                </span>
              )}
            </div>

            {/* Model Selector */}
            <div className="mb-2.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                {isEs ? 'Modelo IA Activo' : 'Active AI Model'}
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className={`w-full h-8 rounded-md border px-2 text-[11px] font-mono outline-none focus:border-amber-500 ${
                  isLight
                    ? 'bg-white border-[#e4dfd5] text-stone-900'
                    : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.tag})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-[11px] font-mono text-muted-foreground mb-2.5">
              <div>
                {isEs ? 'Ensayos:' : 'Firings:'}{' '}
                <span className="text-foreground font-semibold">
                  {contextEnabled
                    ? `${ensayosCount} ${isEs ? 'ensayos reales' : 'real firings'}`
                    : isEs
                      ? '0 (sin contexto)'
                      : '0 (removed)'}
                </span>
              </div>
              <div>
                {isEs ? 'Origen:' : 'Source:'}{' '}
                <span className="text-foreground font-semibold">
                  {!contextEnabled
                    ? isEs
                      ? 'Desactivado'
                      : 'None'
                    : configState.isCustom
                      ? 'JSON personalizado'
                      : 'agente_jesus_context.json'}
                </span>
              </div>
            </div>

            {configNotice && (
              <div className="mb-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
                {configNotice}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-[11px] gap-1 flex-1 cursor-pointer"
              >
                <Upload size={12} />
                {isEs ? 'Meter JSON' : 'Load JSON'}
              </Button>

              {contextEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveContextWindow}
                  className="h-7 text-[11px] gap-1 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                  title={isEs ? 'Quitar ventana de contexto' : 'Remove context window'}
                >
                  <Trash2 size={12} />
                  {isEs ? 'Quitar' : 'Remove'}
                </Button>
              )}

              {(!contextEnabled || configState.isCustom) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreDefaultConfig}
                  className="h-7 text-[11px] gap-1 cursor-pointer"
                  title={isEs ? 'Restaurar JSON original' : 'Restore default JSON'}
                >
                  <RotateCcw size={12} />
                  {!contextEnabled && (isEs ? 'Restaurar' : 'Restore')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CHAT PANE */}
      <section
        className={`lg:col-span-8 xl:col-span-9 flex-1 flex flex-col min-h-0 h-full rounded-xl border overflow-hidden shadow-sm ${
          isLight ? 'bg-white border-[#e4dfd5]' : 'bg-card border-border'
        }`}
      >
        {/* Clean Chat Header */}
        <header
          className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
            isLight
              ? 'bg-amber-50/70 border-[#e4dfd5]'
              : 'bg-slate-900/90 border-border'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Bot size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold truncate">
                  Agente Jesús • {isEs ? 'Ingeniero de Propulsión' : 'Propulsion Engineer'}
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              </div>
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                {snapshotLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!results && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRunSimulation}
                className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
              >
                <Rocket size={13} />
                {isEs ? 'Simular ahora' : 'Simulate now'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={messages.length === 0 || isLoading}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 cursor-pointer"
              title={isEs ? 'Limpiar conversación' : 'Clear chat'}
            >
              <Trash2 size={15} />
            </Button>
          </div>
        </header>

        {/* Messages Feed */}
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8 px-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 border border-amber-500/30">
                <Brain size={24} />
              </div>
              <h3 className="font-bold text-sm mb-1">
                {isEs
                  ? 'Listo para analizar y optimizar tu motor'
                  : 'Ready to analyze and optimize your motor'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isEs
                  ? 'Agente Jesús ya recibe todos los inputs y resultados de HERMES. Pregunta sobre tu simulación o pídele que modifique parámetros respetando tus restricciones.'
                  : 'Agente Jesús already receives all HERMES inputs and results. Ask about your simulation or instruct it to modify parameters under your constraints.'}
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const parsedAssistant = !isUser
              ? extractInputProposalFromText(
                  msg.content,
                  motor,
                  nozzle,
                  grains,
                  customPropellants
                )
              : null;
            const displayText = isUser
              ? msg.content
              : parsedAssistant?.cleanText || msg.content;
            const proposal = parsedAssistant?.proposal || null;

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[94%] sm:max-w-[84%] rounded-xl px-3.5 py-2.5 border shadow-2xs ${
                    isUser
                      ? isLight
                        ? 'bg-purple-600 text-white border-purple-700'
                        : 'bg-purple-600/25 text-slate-100 border-purple-500/40'
                      : isLight
                        ? 'bg-stone-50 text-stone-900 border-[#e4dfd5]'
                        : 'bg-slate-900/90 text-slate-100 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1 text-[10px] font-mono opacity-80">
                    <span className="font-bold flex items-center gap-1.5">
                      {isUser ? (
                        isEs ? 'Ingeniero (Tú)' : 'Engineer (You)'
                      ) : (
                        <>
                          <Bot size={12} className="text-amber-500" />
                          Agente Jesús
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {msg.simSnapshotLabel && (
                        <span className="hidden sm:inline truncate max-w-[210px]">
                          {msg.simSnapshotLabel}
                        </span>
                      )}
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, displayText)}
                          className="hover:text-amber-500 transition-colors cursor-pointer"
                          title={isEs ? 'Copiar respuesta' : 'Copy response'}
                        >
                          {copiedId === msg.id ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser ? (
                    <p className="text-xs sm:text-[13px] whitespace-pre-wrap leading-relaxed">
                      {displayText}
                    </p>
                  ) : (
                    <FormattedMessageContent content={displayText} />
                  )}

                  {/* Interactive Proposed Inputs Card */}
                  {!isUser && proposal && (
                    <div
                      className={`mt-3 rounded-xl border p-3 ${
                        isLight
                          ? 'bg-amber-50/90 border-amber-400/50 text-stone-900'
                          : 'bg-amber-950/30 border-amber-500/40 text-slate-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-2">
                          <Sliders
                            size={15}
                            className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                          />
                          <div>
                            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              {proposal.title}
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {proposal.summary}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`rounded-lg border overflow-hidden mb-2.5 ${
                          isLight
                            ? 'bg-white border-amber-200'
                            : 'bg-slate-950/70 border-slate-800'
                        }`}
                      >
                        <div className="divide-y divide-border/60 text-[11px] font-mono">
                          {proposal.diffs.map((d, idx) => (
                            <div
                              key={idx}
                              className="px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2"
                            >
                              <span className="text-muted-foreground">
                                <strong className="text-foreground">{d.section}</strong>{' '}
                                • {d.label}
                              </span>
                              <span className="flex items-center gap-1.5 font-semibold">
                                <span className="text-muted-foreground line-through">
                                  {d.before}
                                </span>
                                <ArrowRight size={11} className="text-amber-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {d.after}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleApplyProposal(
                              msg.id,
                              proposal.nextMotor,
                              proposal.nextNozzle,
                              proposal.nextGrains,
                              true
                            )
                          }
                          className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 cursor-pointer"
                        >
                          <Play size={13} />
                          {isEs ? 'Aplicar a Inputs y Simular' : 'Apply & Simulate'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleApplyProposal(
                              msg.id,
                              proposal.nextMotor,
                              proposal.nextNozzle,
                              proposal.nextGrains,
                              false
                            )
                          }
                          className="h-8 text-xs gap-1.5 cursor-pointer"
                        >
                          {isEs ? 'Solo aplicar inputs' : 'Apply inputs only'}
                        </Button>

                        {msg.appliedSummary && onNavigateTab && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigateTab('results')}
                            className="h-8 text-xs text-purple-600 dark:text-purple-400 gap-1 cursor-pointer ml-auto"
                          >
                            {isEs ? 'Ver Resultados' : 'View Results'}
                            <ArrowRight size={12} />
                          </Button>
                        )}
                      </div>

                      {msg.appliedSummary && (
                        <div className="mt-2.5 pt-2 border-t border-emerald-500/30 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                          <span className="font-bold flex items-center gap-1">
                            <CheckCircle2 size={13} />
                            {isEs ? 'Simulado:' : 'Simulated:'}
                          </span>
                          <span>Clase {msg.appliedSummary.motorClass}</span>
                          <span>Pmax {msg.appliedSummary.pMaxBar.toFixed(2)} bar</span>
                          <span>Fmax {msg.appliedSummary.fMaxN.toFixed(0)} N</span>
                          <span>It {msg.appliedSummary.itNs.toFixed(0)} N·s</span>
                          <span>Isp {msg.appliedSummary.ispS.toFixed(1)} s</span>
                          <span>tb {msg.appliedSummary.tbS.toFixed(2)} s</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show applied result badge if the message itself was already applied */}
                  {!isUser && !proposal && (msg.appliedSummary || msg.appliedInputs) && (
                    <div className="mt-2.5 pt-2 border-t border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-bold flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          {msg.appliedSummary
                            ? isEs
                              ? 'Aplicado y Simulado:'
                              : 'Applied & Simulated:'
                            : isEs
                              ? 'Inputs aplicados en el simulador'
                              : 'Inputs applied to simulator'}
                        </span>
                        {msg.appliedSummary && (
                          <>
                            <span>Clase {msg.appliedSummary.motorClass}</span>
                            <span>Pmax {msg.appliedSummary.pMaxBar.toFixed(2)} bar</span>
                            <span>Fmax {msg.appliedSummary.fMaxN.toFixed(0)} N</span>
                            <span>It {msg.appliedSummary.itNs.toFixed(0)} N·s</span>
                          </>
                        )}
                      </div>
                      {onNavigateTab && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onNavigateTab(msg.appliedSummary ? 'results' : 'inputs')
                          }
                          className="h-6 px-2 text-[11px] text-purple-600 dark:text-purple-400 gap-1 cursor-pointer"
                        >
                          {msg.appliedSummary
                            ? isEs
                              ? 'Ver Gráficas'
                              : 'View Charts'
                            : isEs
                              ? 'Ver Inputs'
                              : 'View Inputs'}
                          <ArrowRight size={11} />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div
                className={`rounded-xl px-4 py-3 border flex items-center gap-2.5 text-xs font-mono ${
                  isLight
                    ? 'bg-stone-50 border-[#e4dfd5] text-stone-700'
                    : 'bg-slate-900/90 border-slate-800 text-slate-300'
                }`}
              >
                <Loader2 size={15} className="animate-spin text-amber-500" />
                <span>
                  {isEs
                    ? 'Agente Jesús analizando telemetría...'
                    : 'Agente Jesús analyzing telemetry...'}
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl p-3 border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
              <WifiOff size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold">
                  {isEs
                    ? 'No se pudo obtener respuesta de la IA'
                    : 'Failed to reach AI model'}
                </p>
                <p className="font-mono text-[11px] mt-0.5 break-words">{errorMsg}</p>
                <p className="text-[11px] mt-1 opacity-85">
                  {isEs
                    ? 'Nota: El simulador balístico HERMES sigue funcionando 100% offline.'
                    : 'Note: The HERMES ballistic simulator continues operating 100% offline.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Composer Input */}
        <div
          className={`p-3 border-t shrink-0 ${
            isLight ? 'bg-stone-50/80 border-[#e4dfd5]' : 'bg-slate-950/70 border-border'
          }`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isEs
                  ? 'Escribe a Jesús: analiza resultados, o pídele cambios/mejoras (ej. "¿cómo mejoro el motor sin cambiar Dc?")...'
                  : 'Ask Jesús to analyze results or propose parameter changes (e.g. "improve performance without changing Dc")...'
              }
              className={`flex-1 min-h-[44px] max-h-32 resize-y rounded-lg border px-3 py-2 text-xs sm:text-sm outline-none transition-colors focus:border-amber-500 ${
                isLight
                  ? 'bg-white border-[#e4dfd5] text-stone-900 placeholder:text-stone-400'
                  : 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
              }`}
            />
            <Button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="h-11 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold gap-1.5 shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              <span className="hidden sm:inline">
                {isEs ? 'Enviar' : 'Send'}
              </span>
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
};
