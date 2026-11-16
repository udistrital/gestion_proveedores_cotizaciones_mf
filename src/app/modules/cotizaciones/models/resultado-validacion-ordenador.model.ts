/**
 * Modelo del resultado de la validación para el Ordenador del Gasto (O-02).
 *
 * Es una proyección de lectura: no crea un modelo paralelo de la solicitud.
 * Compone `SolicitudDetalle` (con su `DecisionSolicitud`) y el
 * `ResultadoComparativo` de S-09, y resuelve solo lo que necesita la pantalla:
 * el estado de la vista, la franja de proceso y las filas de la tabla de
 * ofertas.
 *
 * La decisión final no se registra aquí (RN-34): O-02 consulta y O-03 decide.
 */

import type { PasoLineaEstados } from "src/app/shared/components/linea-estados/linea-estados.component";
import type { OfertaComparada, ResultadoComparativo } from "./comparativo.model";
import {
  formatoPorcentaje,
} from "./comparativo.model";
import {
  resultadoDecisionSolicitud,
  type SolicitudConDecision,
} from "./decision.model";
import { formatoCop } from "./necesidad.model";
import { sitioWebProveedor } from "./proveedores.model";
import {
  cierreSolicitudVencido,
  type SolicitudDetalle,
} from "./solicitud.model";

/* ── Consulta de la capa de datos ─────────────────────────────────────────── */

/**
 * Resultado de pedir una validación por su identificador.
 *
 * Distingue la solicitud inexistente de la asignada a otro despacho (RN-02):
 * la pantalla muestra un mensaje neutral en ambos casos, pero el contrato del
 * servicio debe poder informarlo sin filtrar datos del expediente.
 */
export type ConsultaValidacionOrdenador =
  | { readonly estado: "ok"; readonly solicitud: SolicitudDetalle }
  | { readonly estado: "no-encontrada" }
  | { readonly estado: "no-asignada" };

/* ── Estado de la vista ───────────────────────────────────────────────────── */

/**
 * Estados de la pantalla.
 *
 * Salen de los datos y de los permisos, nunca de una plantilla por caso:
 * - `sin-acceso`: sin rol de ordenador (RN-32) o asignada a otro despacho (RN-02).
 * - `bloqueado`: el periodo de cotización sigue vigente (RN-29).
 * - `no-disponible`: la solicitud no admite validación (borrador o cancelada).
 * - `sin-decision`: el solicitante aún no remitió su decisión.
 * - `pendiente`: decisión enviada y pendiente de la validación del OG.
 * - `decidida`: aprobada o rechazada, en modo lectura (RN-35).
 */
export type EstadoResultadoValidacion =
  | "cargando"
  | "error"
  | "no-encontrada"
  | "sin-acceso"
  | "bloqueado"
  | "no-disponible"
  | "sin-decision"
  | "pendiente"
  | "decidida";

type SolicitudParaEstado = SolicitudConDecision &
  Pick<SolicitudDetalle, "cierre">;

/**
 * Estado de la vista a partir del expediente.
 *
 * El rol se evalúa antes, en el componente, con
 * `PermisosSolicitudService.puedeAccederValidaciones()`.
 */
export function estadoVistaResultadoValidacion(
  solicitud: SolicitudParaEstado,
): EstadoResultadoValidacion {
  if (solicitud.estado === "cancelada" || solicitud.estado === "borrador") {
    return "no-disponible";
  }

  const cerrado = cierreSolicitudVencido(solicitud.cierre);

  if (solicitud.decision?.fase === "enviada") {
    return cerrado ? "pendiente" : "bloqueado";
  }

  if (resultadoDecisionSolicitud(solicitud)) {
    return "decidida";
  }

  return cerrado ? "sin-decision" : "bloqueado";
}

/* ── Franja de proceso ────────────────────────────────────────────────────── */

/** Etapas del flujo oficial que muestra O-02. */
const ETAPAS_PROCESO: readonly string[] = [
  "Publicada",
  "Abierta",
  "Cerrada",
  "En evaluación",
  "Decisión Solicitante",
  "Validación OG",
  "Resultado",
];

/**
 * Franja de etapas del proceso.
 *
 * Sigue las siete etapas del mockup de O-02. PROVISIONAL: S-09 y S-11 usan
 * franjas de cinco y seis etapas; unificarlas es una tarea transversal.
 */
export function pasosProcesoValidacion(
  solicitud: SolicitudParaEstado,
): readonly PasoLineaEstados[] {
  const estado = estadoVistaResultadoValidacion(solicitud);
  const actual =
    estado === "decidida"
      ? 6
      : estado === "pendiente"
        ? 5
        : estado === "sin-decision"
          ? 4
          : 3;

  return ETAPAS_PROCESO.map((etiqueta, indice) => ({
    etiqueta,
    estado:
      indice < actual
        ? ("completado" as const)
        : indice === actual
          ? ("actual" as const)
          : ("pendiente" as const),
  }));
}

/* ── Tabla de ofertas ─────────────────────────────────────────────────────── */

/** Tono del valor de una oferta; usa los tokens de estado del repo. */
export type TonoValorOferta = "exito" | "error" | "neutro";

/** Fila de la lista de cotizaciones recibidas. */
export interface FilaOfertaValidacion {
  /** Identificador del proveedor; también es la llave de la fila. */
  readonly id: string;
  readonly nombre: string;
  /** NIT o documento con su tipo ("C.C. 79.845.120"). */
  readonly documento: string;
  readonly tipoPersona: string;
  readonly direccion: string;
  readonly sitioWeb: string;
  readonly correo: string;
  readonly ubicacion: string;
  readonly total: string;
  readonly notaValor: string;
  readonly tonoValor: TonoValorOferta;
  /** RN-33: proveedor seleccionado por el jefe de dependencia. */
  readonly seleccionado: boolean;
  /** RN-40: la oferta supera el techo presupuestal. */
  readonly excedePresupuesto: boolean;
  /** Oferta completa de S-09, para los modales de detalle. */
  readonly oferta: OfertaComparada;
}

/** Filas de la tabla: primero el seleccionado y luego por valor ascendente. */
export function filasOfertasValidacion(
  comparativo: ResultadoComparativo,
): readonly FilaOfertaValidacion[] {
  return [...comparativo.ofertas]
    .sort((a, b) => {
      if (a.seleccionado !== b.seleccionado) {
        return a.seleccionado ? -1 : 1;
      }
      return a.total - b.total;
    })
    .map((oferta) => {
      const nota = notaValorOferta(oferta);
      return {
        id: oferta.id,
        nombre: oferta.proveedor.nombre,
        documento: oferta.proveedor.nit,
        tipoPersona: oferta.identidad.etiquetaTipoPersona,
        direccion: oferta.identidad.direccionFiscal,
        sitioWeb: sitioWebProveedor(oferta.proveedor),
        correo: oferta.identidad.correo,
        ubicacion: oferta.identidad.ubicacion,
        total: `${formatoCop(oferta.total)} COP`,
        notaValor: nota.texto,
        tonoValor: nota.tono,
        seleccionado: oferta.seleccionado,
        excedePresupuesto: oferta.excedePresupuesto,
        oferta,
      };
    });
}

/**
 * Nota económica de la fila.
 *
 * Refuerza con texto lo que el color indica: menor valor de referencia,
 * conforme al pliego o fuera del presupuesto (RN-40).
 */
function notaValorOferta(oferta: OfertaComparada): {
  readonly texto: string;
  readonly tono: TonoValorOferta;
} {
  if (oferta.excedePresupuesto) {
    return {
      texto: "Fuera del presupuesto · no se tiene en cuenta (RN-40)",
      tono: "error",
    };
  }
  if (oferta.esMenorTotal) {
    const ahorro =
      oferta.valorPresupuesto > 0
        ? ` (${formatoPorcentaje(
            (Math.abs(oferta.diferencia) / oferta.valorPresupuesto) * 100,
          )}% bajo el techo)`
        : "";
    return { texto: `Menor valor${ahorro}`, tono: "exito" };
  }
  return { texto: "Conforme a pliego", tono: "neutro" };
}

/** Contadores de la cabecera de la tabla de ofertas. */
export interface ResumenOfertasValidacion {
  readonly total: number;
  readonly fueraDePresupuesto: number;
  readonly sinOferta: number;
}

export function resumenOfertasValidacion(
  comparativo: ResultadoComparativo,
): ResumenOfertasValidacion {
  return {
    total: comparativo.ofertas.length,
    fueraDePresupuesto: comparativo.excluidas,
    sinOferta: comparativo.invitadosSinOferta,
  };
}
