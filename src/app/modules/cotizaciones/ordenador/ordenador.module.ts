import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DecisionModule } from "../components/decision/decision.module";
import { ResumenDiferenciasModule } from "../components/resumen-diferencias/resumen-diferencias.module";
import { DetallePresentacionModule } from "../solicitante/pages/detalle-solicitud/components/detalle-presentacion.module";
import { DialogoDetalleOfertaValidacionComponent } from "./components/dialogo-detalle-oferta-validacion/dialogo-detalle-oferta-validacion.component";
import { BandejaModificacionesComponent } from "./pages/bandeja-modificaciones/bandeja-modificaciones.component";
import { BandejaValidacionComponent } from "./pages/bandeja-validacion/bandeja-validacion.component";
import { DecidirModificacionComponent } from "./pages/decidir-modificacion/decidir-modificacion.component";
import { ResultadoValidacionComponent } from "./pages/resultado-validacion/resultado-validacion.component";
import { ValidarCotizacionComponent } from "./pages/validar-cotizacion/validar-cotizacion.component";
import { OrdenadorRoutingModule } from "./ordenador-routing.module";

/**
 * Área lazy exclusiva del Ordenador del Gasto (RN-32).
 *
 * `SolicitudesService`, `OferentesService`, `EvaluacionService` y
 * `ModificacionesService` llegan desde `CotizacionesModule`, que es el único
 * punto de enlace con la implementación simulada (y, mañana, con HTTP).
 * `DetallePresentacionModule` aporta las tarjetas y rejillas de solo lectura;
 * `ResumenDiferenciasModule` el comparativo de S-04 y `DecisionModule` el
 * formulario y la confirmación compartidos con S-11 y O-03.
 */
@NgModule({
  declarations: [
    BandejaValidacionComponent,
    BandejaModificacionesComponent,
    ResultadoValidacionComponent,
    ValidarCotizacionComponent,
    DecidirModificacionComponent,
    DialogoDetalleOfertaValidacionComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    DetallePresentacionModule,
    DecisionModule,
    ResumenDiferenciasModule,
    OrdenadorRoutingModule,
  ],
})
export class OrdenadorModule {}
