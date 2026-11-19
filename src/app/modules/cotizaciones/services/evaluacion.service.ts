import { Injectable } from "@angular/core";
import { Observable, delay, of, throwError } from "rxjs";
import type {
  DecisionSolicitud,
  RegistroEnvioDecision,
  RegistroValidacionDecision,
} from "../models/decision.model";
import type { SolicitudDetalle } from "../models/solicitud.model";
import { SolicitudesService } from "./solicitudes.service";

/**
 * Capa de datos del trámite de decisión (S-11) y de la validación final (O-03).
 *
 * S-11 registra el **envío a validación** de la oferta seleccionada. O-03
 * registra la **aprobación o el rechazo** definitivo del Ordenador del Gasto.
 *
 * Es el único punto que conocen las pantallas. La persistencia del agregado
 * (estado de la solicitud, invitaciones y bitácora) se delega en
 * `SolicitudesService`, que es compartido con el portal del proveedor.
 */
export abstract class EvaluacionService {
  /** Decisión registrada de una solicitud, si existe. */
  abstract obtenerDecision(
    solicitud: SolicitudDetalle,
  ): Observable<DecisionSolicitud | null>;

  /**
   * Registra el envío a validación de la oferta seleccionada.
   *
   * Devuelve la solicitud actualizada para que la vista pase a solo lectura sin
   * repetir la consulta del expediente.
   */
  abstract enviarAValidacion(
    solicitud: SolicitudDetalle,
    datos: RegistroEnvioDecision,
  ): Observable<SolicitudDetalle>;

  /**
   * Registra la validación final del Ordenador del Gasto (O-03).
   *
   * Devuelve la solicitud actualizada para que la vista pase a solo lectura sin
   * repetir la consulta del expediente.
   */
  abstract validarCotizacion(
    solicitud: SolicitudDetalle,
    datos: RegistroValidacionDecision,
  ): Observable<SolicitudDetalle>;
}

/**
 * Implementación simulada.
 *
 * Trucos de desarrollo (query params, sin tocar código):
 * - `?mockDecision=error` → falla la consulta de la decisión.
 * - `?mockDecision=error-envio` → falla el envío a validación.
 * - `?mockDecision=sin-oferta` → simula que no hay oferta seleccionada.
 * - `?mockRetardo=3000` → retardo en ms.
 */
@Injectable()
export class EvaluacionServiceMock extends EvaluacionService {
  constructor(private readonly solicitudes: SolicitudesService) {
    super();
  }

  obtenerDecision(
    solicitud: SolicitudDetalle,
  ): Observable<DecisionSolicitud | null> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 700;

    if (params.get("mockDecision") === "error") {
      return throwError(
        () =>
          new Error(
            "No fue posible consultar la decisión de la solicitud. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    return of(solicitud.decision ?? null).pipe(delay(retardo));
  }

  enviarAValidacion(
    solicitud: SolicitudDetalle,
    datos: RegistroEnvioDecision,
  ): Observable<SolicitudDetalle> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 800;

    if (params.get("mockDecision") === "sin-oferta") {
      return throwError(
        () =>
          new Error(
            "No hay una oferta seleccionada para enviar a validación.",
          ),
      ).pipe(delay(retardo));
    }

    return this.solicitudes.registrarEnvioDecision(solicitud.id, datos);
  }

  validarCotizacion(
    solicitud: SolicitudDetalle,
    datos: RegistroValidacionDecision,
  ): Observable<SolicitudDetalle> {
    const params = new URLSearchParams(window.location.search);
    const retardo = Number(params.get("mockRetardo")) || 900;

    if (params.get("mockValidacion") === "error-guardado") {
      return throwError(
        () =>
          new Error(
            "No fue posible registrar la decisión de validación. Intente nuevamente.",
          ),
      ).pipe(delay(retardo));
    }

    return this.solicitudes.registrarValidacionDecision(solicitud.id, datos);
  }
}
