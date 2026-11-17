import { NgModule } from "@angular/core";
import { CotizacionesRoutingModule } from "./cotizaciones-routing.module";
import {
  ObservacionesService,
  ObservacionesServiceMock,
} from "./services/observaciones.service";
import {
  OferentesService,
  OferentesServiceMock,
} from "./services/oferentes.service";
import {
  SolicitudesService,
  SolicitudesServiceMock,
} from "./services/solicitudes.service";
import {
  EvaluacionService,
  EvaluacionServiceMock,
} from "./services/evaluacion.service";
import { EntradaCotizacionesComponent } from "./pages/entrada-cotizaciones/entrada-cotizaciones.component";
import {
  RespuestaProveedorService,
  RespuestaProveedorServiceMock,
} from "./services/respuesta-proveedor.service";

/**
 * Módulo raíz del dominio de cotizaciones. Las áreas (solicitante,
 * proveedor, ordenador) se cargan de forma perezosa desde su routing.
 */
@NgModule({
  declarations: [EntradaCotizacionesComponent],
  imports: [CotizacionesRoutingModule],
  providers: [
    { provide: SolicitudesService, useClass: SolicitudesServiceMock },
    // Único punto de enlace del trámite de decisión (S-11) y de la validación
    // final (O-03).
    { provide: EvaluacionService, useClass: EvaluacionServiceMock },
    { provide: ObservacionesService, useClass: ObservacionesServiceMock },
    {
      provide: RespuestaProveedorService,
      useClass: RespuestaProveedorServiceMock,
    },
    /*
     * Único punto de enlace del tablero de oferentes (S-07), el comparador
     * (S-09), el detalle del proveedor (S-10) y el resultado de la validación
     * (O-02). Vive aquí, y no en el área solicitante, porque el ordenador del
     * gasto también lo consume.
     */
    { provide: OferentesService, useClass: OferentesServiceMock },
  ],
})
export class CotizacionesModule {}
