import type { EstadoValidacionOrdenador } from "src/app/core/constants/estados-solicitud.const";
import type { DecisionSolicitud } from "./decision.model";
import type { InvitacionProveedor } from "./invitacion-proveedor.model";
import type { Solicitud } from "./solicitud.model";

/**
 * Proyección de lectura de la bandeja de validación (O-01).
 *
 * No es un modelo paralelo de la solicitud: compone las entidades que ya
 * existen (`Solicitud` + `DecisionSolicitud` + la `InvitacionProveedor`
 * cuando está disponible) con la identidad pública del proveedor elegido.
 * Es el mismo patrón de `InvitacionProveedorConSolicitud` en P-01.
 */
export interface ProveedorSeleccionadoValidacion {
  readonly id: string;
  readonly nombre: string;
  /** NIT del banco de proveedores; `null` si no está registrado en el mock. */
  readonly nit: string | null;
}

export interface SolicitudValidacionOrdenador {
  readonly solicitud: Solicitud;
  /** Envío de S-11 y, cuando existe, validación final del OG. */
  readonly decision: DecisionSolicitud;
  readonly proveedor: ProveedorSeleccionadoValidacion;
  /** Invitación del proveedor elegido, si el mock la tiene registrada. */
  readonly invitacion: InvitacionProveedor | null;
}

/** Grupo de los chips rápidos de O-01. */
export type GrupoFiltroValidacion = "todas" | EstadoValidacionOrdenador;

/**
 * Criterios del formulario de filtros de O-01.
 *
 * `estadoValidacion` llega de los chips rápidos (no del formulario). Un valor
 * vacío equivale a «Todas».
 */
export interface FiltroValidacionesOrdenador {
  /** `''` = todas | '2026' | '2025' | '2024' | 'historico' */
  readonly vigencia: string;
  /** `''` = todas | EstadoValidacionOrdenador */
  readonly estadoValidacion: string;
  /** `''` = todas */
  readonly unidadEjecutora: string;
  /** `''` = todos | TipoCotizacion */
  readonly tipoCotizacion: string;
  /** `''` = todas */
  readonly dependencia: string;
  /** Texto libre (número, título, proveedor o NIT). */
  readonly busqueda: string;
  /** Fecha ISO `YYYY-MM-DD` de la remisión de S-11 (inclusive). */
  readonly desde: string;
  /** Fecha ISO `YYYY-MM-DD` de la remisión de S-11 (inclusive). */
  readonly hasta: string;
  readonly ordenNumero: "asc" | "desc";
}

export interface ConteosValidaciones {
  readonly todas: number;
  readonly "por-validar": number;
  readonly "validada-aprobada": number;
  readonly "validada-rechazada": number;
  /** Validadas en el mes calendario en curso (indicador provisional). */
  readonly validadasMes: number;
}

export interface ResultadoListadoValidaciones {
  readonly validaciones: readonly SolicitudValidacionOrdenador[];
  /** Total después del filtro de estado de validación (antes de paginar). */
  readonly total: number;
  /**
   * Contadores por estado de validación calculados sobre la base filtrada
   * (sin aplicar el propio filtro de estado), como en P-01.
   */
  readonly conteos: ConteosValidaciones;
  /** Dependencias presentes en las solicitudes asignadas al ordenador. */
  readonly dependencias: readonly string[];
}

export const GRUPOS_FILTRO_VALIDACION: readonly {
  readonly valor: GrupoFiltroValidacion;
  readonly etiqueta: string;
}[] = [
  { valor: "por-validar", etiqueta: "Pendientes" },
  { valor: "validada-aprobada", etiqueta: "Aprobadas" },
  { valor: "validada-rechazada", etiqueta: "Rechazadas" },
  { valor: "todas", etiqueta: "Todas" },
];

export const TIPOS_COTIZACION_VALIDACION: readonly {
  readonly valor: string;
  readonly etiqueta: string;
}[] = [
  { valor: "", etiqueta: "Todos los tipos" },
  { valor: "BIEN", etiqueta: "Bien" },
  { valor: "SERVICIO", etiqueta: "Servicio" },
  { valor: "BIEN_Y_SERVICIO", etiqueta: "Bien y servicio" },
];

export function conteosValidacionesVacios(): ConteosValidaciones {
  return {
    todas: 0,
    "por-validar": 0,
    "validada-aprobada": 0,
    "validada-rechazada": 0,
    validadasMes: 0,
  };
}

/**
 * Estado del acto de validación.
 *
 * `enviada` significa que el acto está pendiente; la fase `aprobada` o
 * `rechazada` la produce la validación final (hoy solo en la semilla).
 */
export function estadoValidacion(
  fila: Pick<SolicitudValidacionOrdenador, "decision">,
): EstadoValidacionOrdenador {
  switch (fila.decision.fase) {
    case "aprobada":
      return "validada-aprobada";
    case "rechazada":
      return "validada-rechazada";
    case "enviada":
      return "por-validar";
  }
}

/**
 * Partes de una fecha visible `dd/MM/yyyy [HH:mm] [COT]`.
 *
 * Devuelve `null` si el texto no tiene el formato del expediente; así los
 * filtros de fecha y el indicador mensual no dependen de `Date.parse`.
 */
export function partesFechaProcesamiento(
  fecha: string,
): { anio: number; mes: number; dia: number } | null {
  const coincidencia = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(
    fecha.trim(),
  );
  if (!coincidencia) {
    return null;
  }
  const dia = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const anio = Number(coincidencia[3]);
  return dia && mes && anio ? { anio, mes, dia } : null;
}

/** Fecha ISO `YYYY-MM-DD` de una fecha visible del expediente. */
export function fechaProcesamientoIso(fecha: string): string | null {
  const partes = partesFechaProcesamiento(fecha);
  if (!partes) {
    return null;
  }
  return `${partes.anio}-${String(partes.mes).padStart(2, "0")}-${String(
    partes.dia,
  ).padStart(2, "0")}`;
}

/**
 * true si la fecha visible pertenece al mes calendario en curso.
 *
 * PROVISIONAL: el mockup habla de «esta semana»; por decisión de negocio el
 * indicador se cambió a «este mes». El criterio exacto (mes calendario vs.
 * últimos 30 días) sigue abierto y se marca en la vista.
 */
export function esMesActual(fecha: string, referencia = new Date()): boolean {
  const partes = partesFechaProcesamiento(fecha);
  return (
    !!partes &&
    partes.anio === referencia.getFullYear() &&
    partes.mes === referencia.getMonth() + 1
  );
}
