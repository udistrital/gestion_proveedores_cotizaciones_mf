import { Injectable } from "@angular/core";
import { Observable, delay, throwError } from "rxjs";
import type {
  ConsultaModificacionOrdenador,
  FiltroModificacionesOrdenador,
  RegistroDecisionModificacion,
  ResultadoListadoModificaciones,
} from "../models/modificacion-ordenador.model";
import type { SolicitudDetalle } from "../models/solicitud.model";
import { SolicitudesService } from "./solicitudes.service";

/**
 * Capa de datos de las modificaciones por aprobar (O-04).
 *
 * Es el único punto que conocen las pantallas. La persistencia del agregado
 * (propuesta, versión, adenda, bitácora) se delega en `SolicitudesService`,
 * que es compartido con S-03, S-04 y el portal del proveedor.
 */
export abstract class ModificacionesService {
  /** Bandeja paginada con filtros y conteos (O-04). */
  abstract listar(
    criterios: Partial<FiltroModificacionesOrdenador>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListadoModificaciones>;

  /** Expediente y propuesta de una modificación por su radicado. */
  abstract obtener(
    id: string,
  ): Observable<ConsultaModificacionOrdenador>;

  /** Registra la decisión del Ordenador del Gasto (única y definitiva). */
  abstract decidir(
    id: string,
    datos: RegistroDecisionModificacion,
  ): Observable<SolicitudDetalle>;
}

/**
 * Implementación simulada.
 *
 * Trucos de desarrollo (query params, sin tocar código):
 * - `?mockModificaciones=error|vacio` → falla o vacía la bandeja.
 * - `?mockModificacion=error|no-encontrada|no-asignada|error-guardado`.
 * - `?mockRetardo=2500` → retardo en ms.
 */
@Injectable()
export class ModificacionesServiceMock extends ModificacionesService {
  constructor(private readonly solicitudes: SolicitudesService) {
    super();
  }

  listar(
    criterios: Partial<FiltroModificacionesOrdenador>,
    pagina: number,
    porPagina: number,
  ): Observable<ResultadoListadoModificaciones> {
    return this.solicitudes.listarModificacionesOrdenador(
      criterios,
      pagina,
      porPagina,
    );
  }

  obtener(id: string): Observable<ConsultaModificacionOrdenador> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockModificacion") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar la modificación. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    return this.solicitudes.obtenerModificacionOrdenador(id);
  }

  decidir(
    id: string,
    datos: RegistroDecisionModificacion,
  ): Observable<SolicitudDetalle> {
    return this.solicitudes.registrarDecisionModificacion(id, datos);
  }
}
