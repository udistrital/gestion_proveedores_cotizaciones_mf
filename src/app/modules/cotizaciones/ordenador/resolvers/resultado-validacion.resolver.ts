import { inject } from "@angular/core";
import { ResolveFn } from "@angular/router";
import { catchError, map, of, switchMap } from "rxjs";
import type { ResultadoComparativo } from "../../models/comparativo.model";
import { resultadoComparativoVacio } from "../../models/comparativo.model";
import {
  cierreSolicitudVencido,
  type SolicitudDetalle,
} from "../../models/solicitud.model";
import { OferentesService } from "../../services/oferentes.service";
import { SolicitudesService } from "../../services/solicitudes.service";

/**
 * Resultado de resolver el expediente de una validación (O-02).
 *
 * Distingue los cuatro desenlaces que la pantalla sabe pintar: carga correcta,
 * solicitud inexistente, solicitud de otro despacho (RN-02) y fallo de la
 * petición.
 */
export type ResolucionResultadoValidacion =
  | {
      readonly estado: "ok";
      readonly solicitud: SolicitudDetalle;
      readonly comparativo: ResultadoComparativo;
    }
  | { readonly estado: "no-encontrada" }
  | { readonly estado: "no-asignada" }
  | { readonly estado: "error"; readonly mensaje: string };

/**
 * Carga una sola vez el expediente y el comparativo de su validación.
 *
 * El comparativo sale de `OferentesService` (la misma utilidad de S-09), no de
 * un cálculo propio. Antes de abrir el periodo de cotización no se consultan
 * ofertas (RN-29): se entrega un comparativo vacío y la vista explica el
 * bloqueo. Nunca interrumpe la navegación: traduce el fallo a un resultado que
 * la página pinta como estado de error.
 */
export const resultadoValidacionResolver: ResolveFn<
  ResolucionResultadoValidacion
> = (ruta) => {
  const solicitudes = inject(SolicitudesService);
  const oferentes = inject(OferentesService);
  const id = ruta.paramMap.get("id") ?? "";

  return solicitudes.obtenerValidacionOrdenador(id).pipe(
    switchMap((consulta) => {
      if (consulta.estado === "no-encontrada") {
        return of({ estado: "no-encontrada" } as const);
      }
      if (consulta.estado === "no-asignada") {
        return of({ estado: "no-asignada" } as const);
      }

      const solicitud = consulta.solicitud;
      const sinOfertas =
        !cierreSolicitudVencido(solicitud.cierre) ||
        solicitud.estado === "cancelada" ||
        solicitud.estado === "borrador";

      if (sinOfertas) {
        return of({
          estado: "ok",
          solicitud,
          comparativo: resultadoComparativoVacio(
            solicitud.presupuesto?.valorCdp ?? 0,
          ),
        } as const);
      }

      return oferentes.obtenerComparativo(solicitud).pipe(
        map(
          (comparativo) =>
            ({ estado: "ok", solicitud, comparativo }) as const,
        ),
      );
    }),
    catchError((error: Error) =>
      of({
        estado: "error",
        mensaje:
          error.message ||
          "No fue posible consultar el expediente de la validación.",
      } as const),
    ),
  );
};
