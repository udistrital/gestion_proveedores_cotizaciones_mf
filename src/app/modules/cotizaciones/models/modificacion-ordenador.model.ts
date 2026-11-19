import type { EstadoModificacionOrdenador } from "src/app/core/constants/estados-solicitud.const";
import type { PasoLineaEstados } from "src/app/shared/components/linea-estados/linea-estados.component";
import type {
  DecisionModificacion,
  ModificacionPendiente,
  ResumenDiferencias,
} from "./edicion-solicitud.model";
import type { Solicitud, SolicitudDetalle } from "./solicitud.model";

/**
 * Proyección de lectura de las modificaciones por aprobar (O-04).
 *
 * No es un modelo paralelo de la propuesta: compone la fila del listado
 * (`Solicitud`), la propuesta que ya guarda S-04 (`ModificacionPendiente`) y,
 * cuando existe, su resolución. El tipo de cambio y los contadores se derivan
 * del diff restringido de `DiferenciasSolicitudService`.
 */

/** Alcance visible de una modificación (RN-30). */
export type TipoCambioModificacion = "items" | "cierre" | "ambos";

/** Fila de la bandeja y de la decisión del Ordenador del Gasto. */
export interface ModificacionOrdenador {
  /** Radicado de la modificación ("MOD-2026-0041"). */
  readonly radicado: string;
  readonly solicitud: Solicitud;
  readonly propuesta: ModificacionPendiente;
  readonly estado: EstadoModificacionOrdenador;
  /** Decisión registrada cuando la modificación ya fue resuelta. */
  readonly decision?: DecisionModificacion;
  readonly resueltaEl?: string;
  /** Diferencias restringidas (solo ítems y fecha de cierre). */
  readonly diferencias: ResumenDiferencias;
  readonly tipoCambio: TipoCambioModificacion;
  readonly versionAnterior: string;
  readonly versionPropuesta: string;
  readonly cierreVigente: string | null;
  readonly cierrePropuesto: string | null;
  readonly cambiosItems: number;
  readonly cambiosCierre: number;
}

/** Grupo de los chips rápidos de O-04. */
export type GrupoFiltroModificacion = "todas" | EstadoModificacionOrdenador;

/** Criterios del formulario de filtros de O-04. */
export interface FiltroModificacionesOrdenador {
  /** `''` = todas | EstadoModificacionOrdenador */
  readonly estado: string;
  /** `''` = todas */
  readonly dependencia: string;
  /** `''` = todos | TipoCambioModificacion */
  readonly tipoCambio: string;
  /** Texto libre (MOD, solicitud, título, dependencia o solicitante). */
  readonly busqueda: string;
  /** Fecha ISO `YYYY-MM-DD` de radicación (inclusive). */
  readonly desde: string;
  /** Fecha ISO `YYYY-MM-DD` de radicación (inclusive). */
  readonly hasta: string;
  readonly ordenNumero: "asc" | "desc";
}

export interface ConteosModificaciones {
  readonly todas: number;
  readonly "por-aprobar": number;
  readonly aprobada: number;
  readonly rechazada: number;
  /** Aprobadas en el mes calendario en curso (indicador provisional). */
  readonly aprobadasMes: number;
  /** Solicitudes distintas con al menos una modificación aprobada. */
  readonly procesosAprobados: number;
}

export interface ResultadoListadoModificaciones {
  readonly modificaciones: readonly ModificacionOrdenador[];
  /** Total después del filtro de estado (antes de paginar). */
  readonly total: number;
  /** Contadores por estado sobre la base filtrada (sin el estado propio). */
  readonly conteos: ConteosModificaciones;
  /** Dependencias presentes en las solicitudes del ordenador. */
  readonly dependencias: readonly string[];
}

/** Resultado de abrir la decisión de una modificación. */
export type ConsultaModificacionOrdenador =
  | {
      readonly estado: "ok";
      readonly solicitud: SolicitudDetalle;
      readonly modificacion: ModificacionOrdenador;
    }
  | { readonly estado: "no-encontrada" }
  | { readonly estado: "no-asignada" };

/** Datos que O-04 envía al servicio para registrar la decisión. */
export interface RegistroDecisionModificacion {
  readonly resultado: "aprobada" | "rechazada";
  readonly justificacionHtml: string;
  /** Registra la notificación simulada (RF-13). */
  readonly notificar?: boolean;
}

export const GRUPOS_FILTRO_MODIFICACION: readonly {
  readonly valor: GrupoFiltroModificacion;
  readonly etiqueta: string;
}[] = [
  { valor: "por-aprobar", etiqueta: "Pendientes" },
  { valor: "aprobada", etiqueta: "Aprobadas" },
  { valor: "rechazada", etiqueta: "Rechazadas" },
  { valor: "todas", etiqueta: "Todas" },
];

export const TIPOS_CAMBIO_MODIFICACION: readonly {
  readonly valor: string;
  readonly etiqueta: string;
}[] = [
  { valor: "", etiqueta: "Todos los cambios" },
  { valor: "items", etiqueta: "Ítems de la solicitud" },
  { valor: "cierre", etiqueta: "Fecha de cierre" },
  { valor: "ambos", etiqueta: "Ítems y fecha de cierre" },
];

export function conteosModificacionesVacios(): ConteosModificaciones {
  return {
    todas: 0,
    "por-aprobar": 0,
    aprobada: 0,
    rechazada: 0,
    aprobadasMes: 0,
    procesosAprobados: 0,
  };
}

/** Número de cambios de un paso del diff (2 = cronograma, 3 = ítems). */
export function cambiosDelPaso(
  diferencias: ResumenDiferencias,
  paso: number,
): number {
  return (
    diferencias.grupos.find((grupo) => grupo.paso === paso)?.cambios.length ?? 0
  );
}

/** Alcance de la modificación a partir del diff restringido (RN-30). */
export function tipoCambioModificacion(
  diferencias: ResumenDiferencias,
): TipoCambioModificacion {
  const items = cambiosDelPaso(diferencias, 3) > 0;
  const cierre = cambiosDelPaso(diferencias, 2) > 0;
  if (items && cierre) {
    return "ambos";
  }
  return items ? "items" : "cierre";
}

/** Etiqueta visible del alcance de una modificación. */
export function etiquetaTipoCambio(tipo: TipoCambioModificacion): string {
  switch (tipo) {
    case "items":
      return "Ítems de la solicitud";
    case "cierre":
      return "Fecha de cierre";
    case "ambos":
      return "Ítems y fecha de cierre";
  }
}

/**
 * Franja de tres pasos de la decisión (mockup O-04/O-05).
 *
 * Provisional: el mockup no define hitos formales de la modificación; se
 * reutilizan los del expediente (radicación, viabilidad técnica y resolución)
 * para no inventar un ciclo nuevo.
 */
export function pasosProcesoModificacion(
  estado: EstadoModificacionOrdenador,
): readonly PasoLineaEstados[] {
  const decidida = estado !== "por-aprobar";
  return [
    { etiqueta: "Radicación", estado: "completado" },
    { etiqueta: "Viabilidad técnica", estado: "completado" },
    {
      etiqueta: "Resolución del Ordenador",
      estado: decidida ? "completado" : "actual",
    },
  ];
}
