import type { DetalleProveedorOferta } from "./detalle-proveedor-oferta.model";
import type { SolicitudDetalle } from "./solicitud.model";
import {
  estadoVistaResultadoValidacion,
  type EstadoResultadoValidacion,
} from "./resultado-validacion-ordenador.model";
import type { SolicitudConDecision } from "./decision.model";

/**
 * Estados de la pantalla de validación final (O-03).
 *
 * Reutiliza los estados de O-02 para la parte común (cierre, decisión previa,
 * solo lectura) y añade el caso en el que la decisión existe pero el proveedor
 * ya no tiene una oferta consultable.
 */
export type EstadoValidarCotizacion =
  | "cargando"
  | "error"
  | "no-encontrada"
  | "sin-acceso"
  | "no-disponible"
  | "bloqueado"
  | "sin-decision"
  | "sin-proveedor"
  | "pendiente"
  | "decidida";

/** Resultado de la consulta del expediente y de la oferta seleccionada. */
export type ConsultaValidacionCotizacion =
  | {
      readonly estado: "ok";
      readonly solicitud: SolicitudDetalle;
      readonly detalle: DetalleProveedorOferta | null;
    }
  | { readonly estado: "no-encontrada" }
  | { readonly estado: "no-asignada" };

type SolicitudParaEstado = SolicitudConDecision &
  Pick<SolicitudDetalle, "cierre">;

/**
 * Estado de la vista a partir del expediente y de la oferta seleccionada.
 *
 * `estadoVistaResultadoValidacion` ya resuelve RN-29, las solicitudes no
 * disponibles, la falta de decisión y el modo lectura. Aquí solo se distingue
 * el caso en el que la decisión existe pero la oferta desapareció del mock.
 */
export function estadoVistaValidarCotizacion(
  solicitud: SolicitudParaEstado,
  tieneOferta: boolean,
): Exclude<EstadoValidarCotizacion, "cargando" | "error" | "no-encontrada" | "sin-acceso"> {
  const estado: EstadoResultadoValidacion =
    estadoVistaResultadoValidacion(solicitud);

  if (estado === "pendiente" && !tieneOferta) {
    return "sin-proveedor";
  }

  // El resto de estados de O-02 coincide con O-03; `sin-acceso` lo resuelve la
  // página antes de consultar la oferta.
  return estado as Exclude<
    EstadoValidarCotizacion,
    "cargando" | "error" | "no-encontrada" | "sin-acceso"
  >;
}
