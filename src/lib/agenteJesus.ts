import defaultContextJson from '../data/agente_jesus_context.json';
import {
  MotorInput,
  NozzleInput,
  GrainInput,
  CustomPropellant,
  SimulationResults,
  DEFAULT_PROPELLANTS,
  getPropellantData,
} from './types';
import { ApogeeResult } from './apogee';

export interface EnsayoHistorico {
  id_ensayo: string;
  fecha?: string;
  clase_motor?: string;
  inputs_motor?: Record<string, { valor: any; unidad_o_nota?: string }>;
  caso_simulado?: Record<string, { valor: any; unidad_o_nota?: string }>;
  caso_real?: Record<string, { valor: any; unidad_o_nota?: string }>;
  notas_y_dictamen?: {
    dictamen?: string;
    detalle_adicional?: string;
  };
}

export interface AgenteJesusConfig {
  api_key: string;
  model_name: string;
  system_prompt: string;
  knowledge_base: {
    directrices_y_seguridad: string[];
    conocimiento_y_ensayos: {
      instruccion_filtrado_ia: string;
      historial_ensayos: EnsayoHistorico[];
    };
  };
}

export interface InputDiffItem {
  section: string;
  label: string;
  before: string;
  after: string;
}

export interface ProposedSimulationInputs {
  title: string;
  summary: string;
  nextMotor: MotorInput;
  nextNozzle: NozzleInput;
  nextGrains: GrainInput[];
  diffs: InputDiffItem[];
}

export interface AgenteChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  modelUsed?: string;
  simSnapshotLabel?: string;
  appliedInputs?: boolean;
  appliedSummary?: {
    motorClass: string;
    pMaxBar: number;
    fMaxN: number;
    itNs: number;
    ispS: number;
    tbS: number;
  };
}

export interface LiveSimulationContextInput {
  motor: MotorInput;
  nozzle: NozzleInput;
  grains: GrainInput[];
  customPropellants: CustomPropellant[];
  results: SimulationResults | null;
  simApogee: ApogeeResult | null;
  expApogee: ApogeeResult | null;
  maxSafePressureBar?: number | null;
}

const ACTIVATED_STORAGE_KEY = 'hermes_agente_jesus_activated_v1';
const CUSTOM_CONFIG_STORAGE_KEY = 'hermes_agente_jesus_custom_config_v1';
const CONTEXT_ENABLED_STORAGE_KEY = 'hermes_agente_jesus_context_enabled_v1';
const SELECTED_MODEL_STORAGE_KEY = 'hermes_agente_jesus_selected_model_v1';
const CHAT_HISTORY_STORAGE_KEY = 'hermes_agente_jesus_chat_v1';
const MAX_PRESSURE_BAR_STORAGE_KEY = 'hermes_agente_jesus_max_pressure_bar_v1';

// Models retired by NVIDIA NIM (410 Gone) — automatically mapped to active models
const RETIRED_MODELS = new Set<string>(['meta/llama-3.1-70b-instruct']);

export interface AvailableAgentModel {
  id: string;
  label: string;
  tag: string;
}

export const AVAILABLE_AGENT_MODELS: AvailableAgentModel[] = [
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    label: 'Nemotron 3.5 Lightning 30B',
    tag: 'Analítico',
  },
  {
    id: 'nvidia/nemotron-3.5-bolt-e4b',
    label: 'Nemotron 3.5 Bolt E4B',
    tag: 'Rápido',
  },
];

const ERO_MODEL_NAMES: Record<number, string> = {
  1: 'Lineal (y = x)',
  2: 'Exponencial Normalizado',
  3: 'Cuadrático (y = x²)',
  4: 'Raíz Cuadrada (y = √x)',
  5: 'Parábola Cóncava (-x² + 2x)',
  6: 'Senoidal (sin(π/2·x))',
};

const SHAPE_NAMES: Record<number, string> = {
  1: 'Tubular / Cilíndrico (BATES hueco)',
  2: 'Estrella (Star Core)',
  3: 'Sólido / Cilíndrico macizo (End-burner)',
};

export const DEFAULT_AGENTE_JESUS_CONFIG: AgenteJesusConfig =
  defaultContextJson as AgenteJesusConfig;

export function resolveActiveModelId(preferredModel?: string): string {
  if (preferredModel && !RETIRED_MODELS.has(preferredModel)) {
    return preferredModel;
  }
  return AVAILABLE_AGENT_MODELS[0].id;
}

export function isAgenteJesusActivated(): boolean {
  try {
    return localStorage.getItem(ACTIVATED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAgenteJesusActivated(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem(ACTIVATED_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(ACTIVATED_STORAGE_KEY);
    }
  } catch (err) {
    console.error('Error persisting Agente Jesus activation state:', err);
  }
}

export function isContextWindowEnabled(): boolean {
  try {
    const val = localStorage.getItem(CONTEXT_ENABLED_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setContextWindowEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CONTEXT_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {}
}

export function loadSelectedModelId(configModel?: string): string {
  try {
    const saved = localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
    if (saved && !RETIRED_MODELS.has(saved)) return saved;
  } catch {}
  return resolveActiveModelId(configModel);
}

export function saveSelectedModelId(modelId: string): void {
  try {
    localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, modelId);
  } catch {}
}

export function loadAgenteJesusConfig(): {
  config: AgenteJesusConfig;
  isCustom: boolean;
} {
  try {
    const raw = localStorage.getItem(CUSTOM_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.api_key && parsed.model_name && parsed.system_prompt) {
        return { config: parsed as AgenteJesusConfig, isCustom: true };
      }
    }
  } catch (err) {
    console.warn('Invalid custom Agente Jesus config in storage, using default:', err);
  }
  return { config: DEFAULT_AGENTE_JESUS_CONFIG, isCustom: false };
}

export function saveCustomAgenteJesusConfig(config: AgenteJesusConfig): void {
  try {
    localStorage.setItem(CUSTOM_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving custom Agente Jesus config:', err);
  }
}

export function clearCustomAgenteJesusConfig(): void {
  try {
    localStorage.removeItem(CUSTOM_CONFIG_STORAGE_KEY);
  } catch {}
}

export function resetAgenteJesusConfigToDefault(): AgenteJesusConfig {
  clearCustomAgenteJesusConfig();
  setContextWindowEnabled(true);
  return DEFAULT_AGENTE_JESUS_CONFIG;
}

export function parseAgenteContextText(rawText: string): AgenteJesusConfig {
  const trimmed = rawText.trim();
  const candidates = [
    trimmed,
    `${trimmed}\n}`,
    `${trimmed}\n  }\n}`,
    `${trimmed}\n    }\n  }\n}`,
  ];

  let parsed: any = null;
  let lastError: any = null;
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(
      lastError?.message || 'El archivo no tiene un formato JSON válido.'
    );
  }

  if (!parsed.api_key || typeof parsed.api_key !== 'string') {
    throw new Error('Falta el campo obligatorio "api_key" en el JSON.');
  }
  if (!parsed.model_name || typeof parsed.model_name !== 'string') {
    throw new Error('Falta el campo obligatorio "model_name" en el JSON.');
  }
  if (!parsed.system_prompt || typeof parsed.system_prompt !== 'string') {
    throw new Error('Falta el campo obligatorio "system_prompt" en el JSON.');
  }

  return parsed as AgenteJesusConfig;
}

export function loadAgenteChatHistory(): AgenteChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAgenteChatHistory(messages: AgenteChatMessage[]): void {
  try {
    const trimmed = messages.slice(-80);
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Error saving Agente Jesus chat history:', err);
  }
}

export function clearAgenteChatHistory(): void {
  try {
    localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
  } catch {}
}

export function loadMaxSafePressureBar(): string {
  try {
    return localStorage.getItem(MAX_PRESSURE_BAR_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveMaxSafePressureBar(value: string): void {
  try {
    localStorage.setItem(MAX_PRESSURE_BAR_STORAGE_KEY, value);
  } catch {}
}

function roundNum(val: number | undefined | null, decimals = 4): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function estimateGrainMassGrams(
  g: GrainInput,
  customPropellants: CustomPropellant[]
): number {
  let vg = 0;
  if (g.shape === 1) {
    vg = (Math.PI / 4) * (Math.pow(g.D0, 2) - Math.pow(g.d0, 2)) * g.L0;
  } else if (g.shape === 2) {
    const np = g.Np || 5;
    const mx = g.d0mayor / 2;
    const denom = (g.d0 / 2) * Math.sin(Math.PI / np);
    if (denom > 0) {
      const termAtan = Math.atan((mx - (g.d0 / 2) * Math.cos(Math.PI / np)) / denom);
      const pablo = Math.cos(-Math.PI / np + termAtan);
      const starHoleArea =
        np * ((Math.pow(mx, 2) * pablo) / 2 + Math.pow(g.d0 / 2, 2) * Math.sin(Math.PI / np));
      vg = ((Math.PI / 4) * Math.pow(g.D0, 2) - starHoleArea) * g.L0;
    }
  } else if (g.shape === 3) {
    vg = (Math.PI / 4) * Math.pow(g.D0, 2) * g.L0;
  }
  const propData = getPropellantData(g.propellantType, customPropellants);
  const rhoReal = propData.rho * (g.rhorat || 1);
  return Math.max(0, (rhoReal * vg * (g.N || 1)) / 1e3);
}

export function buildSimulationSnapshotLabel(ctx: LiveSimulationContextInput): string {
  const firstProp = ctx.grains[0]
    ? getPropellantData(ctx.grains[0].propellantType, ctx.customPropellants).name
    : 'N/A';
  if (!ctx.results) {
    return `Inputs: Dc ${ctx.motor.Dc}mm • ${firstProp} • Sin simular`;
  }
  const pMaxBar = (ctx.results.summary.Pmax_MPa * 10).toFixed(1);
  return `Clase ${ctx.results.summary.motorClass} • ${firstProp} • Pmax ${pMaxBar} bar • It ${ctx.results.summary.It_total_N_s.toFixed(0)} N·s`;
}

export function buildSimulationContextPayload(ctx: LiveSimulationContextInput) {
  const {
    motor,
    nozzle,
    grains,
    customPropellants,
    results,
    simApogee,
    expApogee,
    maxSafePressureBar,
  } = ctx;

  const expansionRatio =
    nozzle.Dt0 > 0 ? Math.pow(nozzle.Ds / nozzle.Dt0, 2) : null;

  const throatVariationType =
    (nozzle.e || 0) < 0
      ? 'Deposición de escoria en garganta (constricción -ΔDt, provoca subida de presión)'
      : (nozzle.e || 0) > 0
        ? 'Erosión térmica en garganta (+ΔDt, reduce presión)'
        : 'Sin variación de garganta (Dt constante)';

  const formattedGrains = grains.map((g, idx) => {
    const prop = getPropellantData(g.propellantType, customPropellants);
    const massG = estimateGrainMassGrams(g, customPropellants);
    return {
      indice_grano: idx + 1,
      id: g.id,
      geometria_codigo: g.shape,
      geometria_nombre: SHAPE_NAMES[g.shape] || `Tipo ${g.shape}`,
      propulsante: {
        id: g.propellantType,
        nombre: prop.name,
        categoria: prop.category,
        densidad_teorica_g_cm3: prop.rho,
        k_gamma: prop.k,
        M_g_mol: prop.M,
        T0_llama_K: prop.T0,
        a_saint_robert_default: prop.a,
        n_saint_robert_default: prop.n,
        tramos_ley_quemado: prop.pressureRanges || [],
      },
      D0_diametro_exterior_mm: g.D0,
      d0_diametro_interior_mm: g.d0,
      d0mayor_valle_estrella_mm: g.d0mayor,
      L0_longitud_bloque_mm: g.L0,
      N_numero_segmentos: g.N,
      longitud_total_segmentos_mm: roundNum(g.L0 * g.N, 2),
      Np_puntas_estrella: g.Np,
      superficies_inhibidas: {
        osi_cara_exterior_inhibida: g.osi === 1,
        ci_canal_interior_inhibido: g.ci === 1,
        ei_caras_extremas_inhibidas: g.ei === 1,
      },
      rhorat_factor_densidad_relativa: g.rhorat,
      masa_estimada_g: roundNum(massG, 2),
    };
  });

  const totalMassG = formattedGrains.reduce(
    (acc, g) => acc + (g.masa_estimada_g || 0),
    0
  );

  let resultsBlock: any = null;
  if (results && results.t && results.t.length > 0) {
    const s = results.summary;
    const len = results.t.length;

    let peakPIdx = 0;
    let peakFIdx = 0;
    for (let i = 0; i < len; i++) {
      if ((results.P0_MPa[i] || 0) > (results.P0_MPa[peakPIdx] || 0)) peakPIdx = i;
      if ((results.F_N[i] || 0) > (results.F_N[peakFIdx] || 0)) peakFIdx = i;
    }

    const burnStartIdx = Math.min(len - 1, Math.max(1, Math.floor(len * 0.05)));
    const pInitialStabilizedMPa = results.P0_MPa[burnStartIdx] || 0;
    const pMaxMPa = s.Pmax_MPa || 0;
    const postIgnitionPressureRisePct =
      pInitialStabilizedMPa > 0.05
        ? ((pMaxMPa - pInitialStabilizedMPa) / pInitialStabilizedMPa) * 100
        : 0;

    const pMaxBar = pMaxMPa * 10;
    const pMaxKgCm2 = pMaxMPa * 10.197162;
    const pMedBar = (s.Pmed_MPa || 0) * 10;
    const pMedKgCm2 = (s.Pmed_MPa || 0) * 10.197162;

    const exceedsUserLimit =
      typeof maxSafePressureBar === 'number' &&
      maxSafePressureBar > 0 &&
      pMaxBar > maxSafePressureBar;

    const targetSamples = 28;
    const indexSet = new Set<number>([0, burnStartIdx, peakPIdx, peakFIdx, len - 1]);
    if (len > 2) {
      const step = Math.max(1, Math.floor((len - 1) / targetSamples));
      for (let i = 0; i < len; i += step) {
        indexSet.add(i);
      }
    }
    const sortedIndices = Array.from(indexSet).sort((a, b) => a - b);

    const sampledCurve = sortedIndices.map((i) => ({
      t_s: roundNum(results.t[i], 4),
      P0_abs_MPa: roundNum(results.P0_MPa[i], 4),
      P0_abs_bar: roundNum((results.P0_MPa[i] || 0) * 10, 2),
      P0_manometrica_MPa: roundNum(results.P0_gage[i], 4),
      F_real_N: roundNum(results.F_N[i], 2),
      F_real_kgf: roundNum(results.F_kg[i], 2),
      E_ideal_N: roundNum(results.E_N[i], 2),
      Kn: roundNum(results.Kn?.[i], 1),
      At_mm2: roundNum(results.At_mm2?.[i], 2),
      r_burn_mm_s: roundNum(results.r_burn?.[i], 2),
      mdot_gen_kg_s: roundNum(results.mdot_gen?.[i], 4),
      mdot_noz_kg_s: roundNum(results.mdot_noz?.[i], 4),
      Ab_total_mm2: roundNum(results.Ab_total?.[i], 1),
      masa_propulsor_restante_kg: roundNum(results.mgra_total[i], 4),
    }));

    const atInitial = results.At_mm2?.[0] ?? null;
    const atFinal = results.At_mm2?.[len - 1] ?? null;

    resultsBlock = {
      resumen_global: {
        clase_motor: s.motorClass,
        presion_maxima_MPa: roundNum(s.Pmax_MPa, 4),
        presion_maxima_bar: roundNum(pMaxBar, 2),
        presion_maxima_kg_cm2: roundNum(pMaxKgCm2, 2),
        presion_media_MPa: roundNum(s.Pmed_MPa, 4),
        presion_media_bar: roundNum(pMedBar, 2),
        presion_media_kg_cm2: roundNum(pMedKgCm2, 2),
        tiempo_combustion_tb_s: roundNum(s.t_quemado, 3),
        tiempo_total_simulacion_tfin_s: roundNum(s.t_fin, 3),
        empuje_maximo_N: roundNum(s.Fmax_N, 2),
        empuje_maximo_kgf: roundNum(s.Fmax_N / 9.80665, 2),
        empuje_medio_N: roundNum(s.Fmed_N, 2),
        empuje_medio_kgf: roundNum(s.Fmed_N / 9.80665, 2),
        impulso_total_It_Ns: roundNum(s.It_total_N_s, 2),
        impulso_especifico_Isp_s: roundNum(s.Isp_total_s, 2),
        k_gamma_promedio: roundNum(s.k_avg, 4),
        Kn_inicial: roundNum(s.Kn_initial, 1),
        Kn_maximo: roundNum(s.Kn_max, 1),
        Kn_medio: roundNum(s.Kn_avg, 1),
        Kn_final: roundNum(s.Kn_final, 1),
        velocidad_quemado_r_inicial_mm_s: roundNum(s.r_initial, 2),
        velocidad_quemado_r_max_mm_s: roundNum(s.r_max, 2),
        velocidad_quemado_r_media_mm_s: roundNum(s.r_avg, 2),
        flujo_masico_max_kg_s: roundNum(s.mdot_max, 4),
        flujo_masico_medio_kg_s: roundNum(s.mdot_avg, 4),
        masa_propulsor_inicial_g: roundNum(s.initial_mass_g ?? totalMassG, 2),
      },
      diagnostico_curva_automatico: {
        presion_inicio_estabilizada_bar: roundNum(pInitialStabilizedMPa * 10, 2),
        presion_pico_bar: roundNum(pMaxBar, 2),
        tiempo_pico_presion_s: roundNum(results.t[peakPIdx], 4),
        posicion_relativa_pico_pct: roundNum((peakPIdx / Math.max(1, len - 1)) * 100, 1),
        subida_presion_post_inicio_pct: roundNum(postIgnitionPressureRisePct, 2),
        tiempo_pico_empuje_s: roundNum(results.t[peakFIdx], 4),
        area_garganta_inicial_mm2: roundNum(atInitial, 2),
        area_garganta_final_mm2: roundNum(atFinal, 2),
        supera_limite_seguridad_usuario: exceedsUserLimit,
        numero_puntos_totales_simulados: len,
      },
      curva_temporal_muestreada: sampledCurve,
    };
  }

  return {
    simulacion_ejecutada: Boolean(results),
    limite_seguridad_presion_usuario_bar:
      typeof maxSafePressureBar === 'number' && maxSafePressureBar > 0
        ? maxSafePressureBar
        : 'No definido todavía por el usuario (PREGUNTAR al usuario al inicio si tiene un límite máximo en bar o medidas de seguridad que implementar)',
    propulsantes_disponibles: [...DEFAULT_PROPELLANTS, ...customPropellants].map((p) => ({
      id: p.id,
      nombre: p.name,
      categoria: p.category,
    })),
    inputs_motor_actual: {
      camara_combustion: {
        Dc_diametro_interior_mm: motor.Dc,
        Lc_longitud_camara_mm: motor.Lc,
        longitud_total_granos_mm: roundNum(
          grains.reduce((acc, g) => acc + (g.L0 || 0) * (g.N || 0), 0),
          2
        ),
        Gstar_umbral_erosivo_kg_m2s: motor.Gstar,
        kv_coeficiente_erosivo: motor.kv,
        etac_eficiencia_combustion: motor.etac,
        paso_de_tiempo_dt_s: motor.paso_de_tiempo,
        Pamb_presion_ambiente_MPa: motor.Pamb,
        Pamb_presion_ambiente_bar: roundNum(motor.Pamb * 10, 4),
      },
      tobera: {
        Dt0_garganta_inicial_mm: nozzle.Dt0,
        Ds_salida_mm: nozzle.Ds,
        relacion_expansion_area: roundNum(expansionRatio, 3),
        e_variacion_diametro_garganta_mm: nozzle.e,
        interpretacion_variacion_garganta: throatVariationType,
        modelo_progresion_erosion_escoria:
          ERO_MODEL_NAMES[nozzle.ero_model || 1] || 'Lineal',
        alpha_semiangulo_divergente_deg: nozzle.alpha,
        etanoz_eficiencia_tobera: nozzle.etanoz,
      },
      granos_propulsante: formattedGrains,
      masa_total_propulsor_estimada_g: roundNum(totalMassG, 2),
    },
    resultados_simulacion_actual: resultsBlock,
    control_mision_vuelo:
      simApogee || expApogee
        ? {
            apogeo_simulado: simApogee
              ? {
                  apogeo_maximo_m: roundNum(simApogee.maxApogee, 1),
                  velocidad_max_m_s: roundNum(simApogee.maxVelocity, 2),
                  mach_max: roundNum(
                    simApogee.mach?.length ? Math.max(...simApogee.mach) : 0,
                    3
                  ),
                  aceleracion_max_m_s2: roundNum(simApogee.maxAcceleration, 2),
                  tiempo_apogeo_s: roundNum(simApogee.apogeeTime, 2),
                }
              : null,
            apogeo_experimental: expApogee
              ? {
                  apogeo_maximo_m: roundNum(expApogee.maxApogee, 1),
                  velocidad_max_m_s: roundNum(expApogee.maxVelocity, 2),
                  mach_max: roundNum(
                    expApogee.mach?.length ? Math.max(...expApogee.mach) : 0,
                    3
                  ),
                  aceleracion_max_m_s2: roundNum(expApogee.maxAcceleration, 2),
                  tiempo_apogeo_s: roundNum(expApogee.apogeeTime, 2),
                }
              : null,
          }
        : null,
  };
}

export function buildSystemPromptWithContext(
  config: AgenteJesusConfig,
  simContext: LiveSimulationContextInput,
  lang: string,
  contextEnabled: boolean
): string {
  const liveData = buildSimulationContextPayload(simContext);
  const langHint =
    lang === 'en'
      ? 'Responde en el idioma en que te escriba el usuario (si te escribe en inglés, responde en inglés; si te escribe en español, en español).'
      : 'Responde preferiblemente en español técnico salvo que el usuario te escriba en otro idioma.';

  const actionModificationGuide = [
    '=== CAPACIDAD DE MODIFICAR INPUTS Y RECOMENDAR SIMULACIONES EN HERMES ===',
    'El usuario puede pedirte directamente que modifiques parámetros del simulador o que le recomiendes una configuración mejorada respetando restricciones (por ejemplo: "mejora mi configuración sin cambiar Dc", "baja la presión máxima ajustando Dt0", "cambia a grano estrella", etc.).',
    'Cuando propongas o apliques una nueva configuración de motor, además de explicarla claramente con tus cálculos y criterios técnicos, DEBES incluir AL FINAL de tu mensaje un bloque JSON exactamente con el delimitador ```hermes_inputs (y cerrado con ```) siguiendo este esquema:',
    '```hermes_inputs',
    '{',
    '  "hermes_action": "apply_inputs",',
    '  "titulo": "Nombre corto de la propuesta",',
    '  "resumen": "Resumen en 1 frase de qué se cambia y qué efecto físico se busca",',
    '  "motor": { "Dc": 60.5, "Lc": 483, "Gstar": 2, "kv": 0, "etac": 0.85, "paso_de_tiempo": 0.0005, "Pamb": 0.101325 },',
    '  "nozzle": { "Dt0": 18.8, "Ds": 41.1, "e": 0, "ero_model": 1, "alpha": 12, "etanoz": 0.75 },',
    '  "grains": [',
    '    { "shape": 1, "propellantType": 1, "D0": 56, "d0": 25, "d0mayor": 0, "L0": 60, "N": 5, "Np": 0, "osi": 1, "ci": 1, "ei": 1, "rhorat": 0.94 }',
    '  ]',
    '}',
    '```',
    'REGLAS ESTRICTAS PARA EL BLOQUE hermes_inputs:',
    '1. Puedes incluir solo los objetos/campos que cambien ("motor", "nozzle" y/o "grains"), o la configuración completa. Si modificas un grano, procura devolver el array "grains" completo (conservando los granos no modificados).',
    '2. Respeta escrupulosamente cualquier parámetro que el usuario pida NO cambiar (por ejemplo, si dice "sin cambiar Dc ni propulsante", mantenlos idénticos a inputs_motor_actual).',
    '3. Validez física obligatoria: D0 <= Dc; si shape=1 (Tubular), 0 < d0 < D0; si shape=2 (Estrella), Np >= 3 y d0 < d0mayor < D0; si shape=3 (Sólido), d0=0; N >= 1 (entero); L0*N <= Lc; Dt0 > 0; Ds >= Dt0; 0 < etac <= 1; 0 < etanoz <= 1; propellantType debe ser uno de los IDs de "propulsantes_disponibles".',
    '4. NO incluyas el bloque ```hermes_inputs si el usuario solo hace una pregunta conceptual o pide un análisis sin pedir cambios ni una configuración recomendada aplicable.',
  ].join('\n');

  if (!contextEnabled) {
    return [
      'Eres un asistente técnico de ingeniería aeroespacial integrado en el simulador de motores cohete sólidos HERMES.',
      'Nota: El usuario ha desactivado/quitado la ventana de contexto y la base de conocimiento de ensayos históricos. Trabaja únicamente con los datos en vivo del simulador HERMES y el conocimiento general de propulsión.',
      '',
      actionModificationGuide,
      '',
      '=== TELEMETRÍA EN TIEMPO REAL DEL SIMULADOR HERMES (INPUTS + RESULTS ACTUALES) ===',
      JSON.stringify(liveData, null, 2),
      '',
      langHint,
    ].join('\n');
  }

  const directrices = (config.knowledge_base?.directrices_y_seguridad || [])
    .map((d, i) => `${i + 1}. ${d}`)
    .join('\n');

  const instruccionFiltrado =
    config.knowledge_base?.conocimiento_y_ensayos?.instruccion_filtrado_ia || '';
  const historial =
    config.knowledge_base?.conocimiento_y_ensayos?.historial_ensayos || [];

  return [
    config.system_prompt,
    '',
    '=== DIRECTRICES Y SEGURIDAD ===',
    directrices,
    '',
    '=== INSTRUCCIÓN DE FILTRADO DE HISTORIAL DE ENSAYOS ===',
    instruccionFiltrado,
    '',
    '=== HISTORIAL DE ENSAYOS DE REFERENCIA (BASE DE CONOCIMIENTO) ===',
    JSON.stringify(historial),
    '',
    '=== TELEMETRÍA EN TIEMPO REAL DEL SIMULADOR HERMES (INPUTS + RESULTS ACTUALES) ===',
    'IMPORTANTE: Los siguientes datos JSON corresponden exactamente a la configuración y última simulación activa en HERMES en este preciso momento. El usuario NO necesita repetírtelos; úsalos directamente en tu análisis, compara con los 2-3 ensayos más similares del historial y verifica riesgos de sobrepresión o deposición de escoria.',
    JSON.stringify(liveData, null, 2),
    '',
    actionModificationGuide,
    '',
    'RECORDATORIO FINAL: Si el usuario te pide cambiar parámetros o recomendar una configuración/simulación mejorada, incluye OBLIGATORIAMENTE el bloque ```hermes_inputs al final de tu respuesta.',
    langHint,
  ].join('\n');
}

function toFiniteNumber(val: unknown): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function fmtNum(val: number | undefined, suffix = ''): string {
  if (val === undefined || !Number.isFinite(val)) return 'N/A';
  const rounded = Math.abs(val) < 0.01 && val !== 0 ? val.toFixed(4) : Number(val.toFixed(3)).toString();
  return suffix ? `${rounded} ${suffix}` : rounded;
}

export function extractInputProposalFromText(
  rawContent: string,
  currentMotor: MotorInput,
  currentNozzle: NozzleInput,
  currentGrains: GrainInput[],
  customPropellants: CustomPropellant[]
): {
  cleanText: string;
  proposal: ProposedSimulationInputs | null;
} {
  let matchedBlock: string | null = null;
  let jsonBody: string | null = null;

  const hermesMatch = rawContent.match(/```hermes_inputs\s*([\s\S]*?)```/i);
  if (hermesMatch) {
    matchedBlock = hermesMatch[0];
    jsonBody = hermesMatch[1].trim();
  } else {
    // Fallback if model tagged it as ```json with hermes_action
    const jsonBlocks = Array.from(rawContent.matchAll(/```json\s*([\s\S]*?)```/gi));
    for (const m of jsonBlocks) {
      if (m[1] && m[1].includes('hermes_action')) {
        matchedBlock = m[0];
        jsonBody = m[1].trim();
        break;
      }
    }
  }

  if (!matchedBlock || !jsonBody) {
    return { cleanText: rawContent, proposal: null };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(jsonBody);
  } catch {
    return { cleanText: rawContent, proposal: null };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { cleanText: rawContent, proposal: null };
  }

  const validPropellantIds = new Set([
    ...DEFAULT_PROPELLANTS.map((p) => p.id),
    ...customPropellants.map((p) => p.id),
  ]);

  // Merge Motor
  const pm = parsed.motor && typeof parsed.motor === 'object' ? parsed.motor : {};
  const nextMotor: MotorInput = {
    Dc: clamp(toFiniteNumber(pm.Dc) ?? currentMotor.Dc, 5, 2000),
    Lc: clamp(toFiniteNumber(pm.Lc) ?? currentMotor.Lc, 5, 10000),
    Gstar: clamp(toFiniteNumber(pm.Gstar) ?? currentMotor.Gstar, 0, 500),
    kv: clamp(toFiniteNumber(pm.kv) ?? currentMotor.kv, 0, 10),
    etac: clamp(toFiniteNumber(pm.etac) ?? currentMotor.etac, 0.1, 1.0),
    paso_de_tiempo: clamp(
      toFiniteNumber(pm.paso_de_tiempo) ?? currentMotor.paso_de_tiempo,
      0.0001,
      0.05
    ),
    Pamb: clamp(toFiniteNumber(pm.Pamb) ?? currentMotor.Pamb, 0.001, 2.0),
  };

  // Merge Nozzle
  const pn = parsed.nozzle && typeof parsed.nozzle === 'object' ? parsed.nozzle : {};
  const nextDt0 = clamp(toFiniteNumber(pn.Dt0) ?? currentNozzle.Dt0, 1, nextMotor.Dc);
  const nextDs = clamp(toFiniteNumber(pn.Ds) ?? currentNozzle.Ds, nextDt0, nextMotor.Dc * 2);
  const rawEroModel = toFiniteNumber(pn.ero_model);
  const nextEroModel =
    rawEroModel && rawEroModel >= 1 && rawEroModel <= 6
      ? (Math.round(rawEroModel) as 1 | 2 | 3 | 4 | 5 | 6)
      : currentNozzle.ero_model;

  const nextNozzle: NozzleInput = {
    Dt0: nextDt0,
    Ds: nextDs,
    e: clamp(toFiniteNumber(pn.e) ?? currentNozzle.e, -nextDt0 * 0.5, nextDt0 * 0.8),
    ero_model: nextEroModel,
    alpha: clamp(toFiniteNumber(pn.alpha) ?? currentNozzle.alpha, 1, 45),
    etanoz: clamp(toFiniteNumber(pn.etanoz) ?? currentNozzle.etanoz, 0.1, 1.0),
  };

  // Merge Grains
  let nextGrains: GrainInput[] = currentGrains.map((g) => ({ ...g }));
  if (Array.isArray(parsed.grains) && parsed.grains.length > 0) {
    nextGrains = parsed.grains.map((pg: any, idx: number) => {
      const base = currentGrains[idx] || currentGrains[0] || {
        id: `${Date.now()}-${idx}`,
        shape: 1 as 1 | 2 | 3,
        propellantType: 1,
        D0: 56,
        d0: 25,
        d0mayor: 0,
        L0: 60,
        N: 1,
        Np: 0,
        osi: 1,
        ci: 1,
        ei: 1,
        rhorat: 0.94,
      };
      const rawShape = toFiniteNumber(pg.shape);
      const shape =
        rawShape === 1 || rawShape === 2 || rawShape === 3 ? rawShape : base.shape;
      const rawProp = toFiniteNumber(pg.propellantType);
      const propellantType =
        rawProp !== undefined && validPropellantIds.has(Math.round(rawProp))
          ? Math.round(rawProp)
          : base.propellantType;

      const D0 = clamp(toFiniteNumber(pg.D0) ?? base.D0, 5, nextMotor.Dc);
      const d0 =
        shape === 3
          ? 0
          : clamp(toFiniteNumber(pg.d0) ?? base.d0, 1, Math.max(1, D0 - 1));
      const d0mayor =
        shape === 2
          ? clamp(
              toFiniteNumber(pg.d0mayor) ?? (base.d0mayor > d0 ? base.d0mayor : (D0 + d0) / 2),
              d0 + 0.5,
              Math.max(d0 + 0.5, D0 - 0.5)
            )
          : toFiniteNumber(pg.d0mayor) ?? base.d0mayor;
      const N = Math.max(1, Math.round(toFiniteNumber(pg.N) ?? base.N));
      const L0 = clamp(toFiniteNumber(pg.L0) ?? base.L0, 5, nextMotor.Lc);
      const Np =
        shape === 2
          ? Math.max(3, Math.round(toFiniteNumber(pg.Np) ?? (base.Np || 5)))
          : Math.max(0, Math.round(toFiniteNumber(pg.Np) ?? base.Np));

      const toBool01 = (v: unknown, fallback: number) => {
        if (v === true || v === 1 || v === '1') return 1;
        if (v === false || v === 0 || v === '0') return 0;
        return fallback;
      };

      return {
        id: typeof pg.id === 'string' && pg.id ? pg.id : base.id || `${Date.now()}-${idx}`,
        shape,
        propellantType,
        D0,
        d0,
        d0mayor,
        L0,
        N,
        Np,
        osi: toBool01(pg.osi, base.osi),
        ci: toBool01(pg.ci, base.ci),
        ei: toBool01(pg.ei, base.ei),
        rhorat: clamp(toFiniteNumber(pg.rhorat) ?? base.rhorat, 0.5, 1.05),
      };
    });
  }

  // Build exact diff list
  const diffs: InputDiffItem[] = [];
  const checkDiff = (
    section: string,
    label: string,
    prev: number | undefined,
    next: number | undefined,
    unit = ''
  ) => {
    if (prev === undefined && next === undefined) return;
    if (Math.abs((prev ?? 0) - (next ?? 0)) > 1e-6) {
      diffs.push({
        section,
        label,
        before: fmtNum(prev, unit),
        after: fmtNum(next, unit),
      });
    }
  };

  checkDiff('Cámara', 'Diámetro Dc', currentMotor.Dc, nextMotor.Dc, 'mm');
  checkDiff('Cámara', 'Longitud Lc', currentMotor.Lc, nextMotor.Lc, 'mm');
  checkDiff('Cámara', 'Eficiencia ηc', currentMotor.etac, nextMotor.etac);
  checkDiff('Cámara', 'Umbral G*', currentMotor.Gstar, nextMotor.Gstar, 'kg/m²s');
  checkDiff('Cámara', 'Coef. Erosivo kv', currentMotor.kv, nextMotor.kv);
  checkDiff('Cámara', 'Paso Δt', currentMotor.paso_de_tiempo, nextMotor.paso_de_tiempo, 's');
  checkDiff('Cámara', 'Presión Pamb', currentMotor.Pamb, nextMotor.Pamb, 'MPa');

  checkDiff('Tobera', 'Garganta Dt0', currentNozzle.Dt0, nextNozzle.Dt0, 'mm');
  checkDiff('Tobera', 'Salida Ds', currentNozzle.Ds, nextNozzle.Ds, 'mm');
  checkDiff('Tobera', 'Variación ΔDt (e)', currentNozzle.e, nextNozzle.e, 'mm');
  checkDiff('Tobera', 'Semiángulo α', currentNozzle.alpha, nextNozzle.alpha, '°');
  checkDiff('Tobera', 'Eficiencia ηnoz', currentNozzle.etanoz, nextNozzle.etanoz);

  if (currentGrains.length !== nextGrains.length) {
    diffs.push({
      section: 'Granos',
      label: 'Bloques configurados',
      before: `${currentGrains.length}`,
      after: `${nextGrains.length}`,
    });
  }

  const shapeShort: Record<number, string> = {
    1: 'Tubular',
    2: 'Estrella',
    3: 'Sólido',
  };

  nextGrains.forEach((ng, idx) => {
    const cg = currentGrains[idx];
    const sec = `Grano #${idx + 1}`;
    if (!cg) {
      const propName = getPropellantData(ng.propellantType, customPropellants).name;
      diffs.push({
        section: sec,
        label: 'Nuevo grano',
        before: '—',
        after: `${shapeShort[ng.shape]} • ${propName} • D0=${ng.D0}/d0=${ng.d0}/L0=${ng.L0}mm ×${ng.N}`,
      });
      return;
    }
    if (cg.shape !== ng.shape) {
      diffs.push({
        section: sec,
        label: 'Geometría',
        before: shapeShort[cg.shape] || `${cg.shape}`,
        after: shapeShort[ng.shape] || `${ng.shape}`,
      });
    }
    if (cg.propellantType !== ng.propellantType) {
      diffs.push({
        section: sec,
        label: 'Propulsante',
        before: getPropellantData(cg.propellantType, customPropellants).name,
        after: getPropellantData(ng.propellantType, customPropellants).name,
      });
    }
    checkDiff(sec, 'D0 exterior', cg.D0, ng.D0, 'mm');
    checkDiff(sec, 'd0 interior', cg.d0, ng.d0, 'mm');
    checkDiff(sec, 'd0mayor valle', cg.d0mayor, ng.d0mayor, 'mm');
    checkDiff(sec, 'Longitud L0', cg.L0, ng.L0, 'mm');
    checkDiff(sec, 'Segmentos N', cg.N, ng.N);
    checkDiff(sec, 'Puntas estrella Np', cg.Np, ng.Np);
    checkDiff(sec, 'Inhibición ext (osi)', cg.osi, ng.osi);
    checkDiff(sec, 'Inhibición núcleo (ci)', cg.ci, ng.ci);
    checkDiff(sec, 'Inhibición caras (ei)', cg.ei, ng.ei);
    checkDiff(sec, 'Densidad rel. (rhorat)', cg.rhorat, ng.rhorat);
  });

  const cleanText = rawContent.replace(matchedBlock, '').trim();

  if (diffs.length === 0) {
    return { cleanText, proposal: null };
  }

  return {
    cleanText,
    proposal: {
      title:
        typeof parsed.titulo === 'string' && parsed.titulo.trim()
          ? parsed.titulo.trim()
          : 'Configuración recomendada por Agente Jesús',
      summary:
        typeof parsed.resumen === 'string' && parsed.resumen.trim()
          ? parsed.resumen.trim()
          : 'Ajuste de parámetros del motor listo para aplicar y simular.',
      nextMotor,
      nextNozzle,
      nextGrains,
      diffs,
    },
  };
}

function getNvidiaEndpointUrl(): string {
  const isElectronEnv =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' ||
      Boolean((window as any).process?.versions?.electron) ||
      navigator.userAgent.includes('Electron'));

  if (isElectronEnv) {
    return 'https://integrate.api.nvidia.com/v1/chat/completions';
  }
  return '/api/nvidia/v1/chat/completions';
}

export interface AgenteResponseResult {
  reply: string;
  modelUsed: string;
}

export async function sendChatToAgenteJesus(params: {
  config: AgenteJesusConfig;
  selectedModelId: string;
  contextEnabled: boolean;
  messages: AgenteChatMessage[];
  simContext: LiveSimulationContextInput;
  lang: string;
  signal?: AbortSignal;
}): Promise<AgenteResponseResult> {
  const {
    config,
    selectedModelId,
    contextEnabled,
    messages,
    simContext,
    lang,
    signal,
  } = params;

  const systemPrompt = buildSystemPromptWithContext(
    config,
    simContext,
    lang,
    contextEnabled
  );

  const conversationTurns = messages.slice(-14).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const endpoint = getNvidiaEndpointUrl();
  const primaryModel = resolveActiveModelId(selectedModelId || config.model_name);
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      ...AVAILABLE_AGENT_MODELS.map((m) => m.id),
    ])
  );

  let lastErrorText = '';
  let lastStatus = 0;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    const requestBody: Record<string, any> = {
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...conversationTurns],
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 3072,
    };
    if (model.includes('nemotron-3.5-lightning')) {
      requestBody.chat_template_kwargs = { enable_thinking: false };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (response.ok) {
      const data = await response.json();
      const choice = data?.choices?.[0]?.message;
      const content =
        (typeof choice?.content === 'string' && choice.content.trim()) ||
        (typeof choice?.reasoning_content === 'string' &&
          choice.reasoning_content.trim()) ||
        '';

      if (!content) {
        throw new Error('El modelo devolvió una respuesta vacía.');
      }

      return {
        reply: content,
        modelUsed: model,
      };
    }

    lastStatus = response.status;
    lastErrorText = await response.text().catch(() => '');

    const shouldFallback =
      (response.status === 410 || response.status === 404) &&
      i < candidateModels.length - 1;
    if (shouldFallback) {
      console.warn(
        `[Agente Jesús] Model "${model}" returned HTTP ${response.status}; trying next active model.`
      );
      continue;
    }

    break;
  }

  throw new Error(
    `Error de conexión con el modelo IA (HTTP ${lastStatus}): ${
      lastErrorText.slice(0, 240) || 'Verifica tu conexión a internet o API key.'
    }`
  );
}
