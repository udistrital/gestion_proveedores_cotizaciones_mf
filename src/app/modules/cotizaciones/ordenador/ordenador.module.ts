import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DetallePresentacionModule } from "../solicitante/pages/detalle-solicitud/components/detalle-presentacion.module";
import { DialogoDetalleOfertaValidacionComponent } from "./components/dialogo-detalle-oferta-validacion/dialogo-detalle-oferta-validacion.component";
import { BandejaValidacionComponent } from "./pages/bandeja-validacion/bandeja-validacion.component";
import { PantallaOrdenadorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-ordenador-placeholder.component";
import { ResultadoValidacionComponent } from "./pages/resultado-validacion/resultado-validacion.component";
import { OrdenadorRoutingModule } from "./ordenador-routing.module";

/**
 * Área lazy exclusiva del Ordenador del Gasto (RN-32).
 *
 * `SolicitudesService` y `OferentesService` llegan desde `CotizacionesModule`,
 * que es el único punto de enlace con la implementación simulada (y, mañana,
 * con HTTP). `DetallePresentacionModule` aporta las tarjetas y rejillas de solo
 * lectura que ya usan S-03, S-10 y P-07.
 */
@NgModule({
  declarations: [
    BandejaValidacionComponent,
    ResultadoValidacionComponent,
    DialogoDetalleOfertaValidacionComponent,
    PantallaOrdenadorPlaceholderComponent,
  ],
  imports: [
    CommonModule,
    SharedModule,
    DetallePresentacionModule,
    OrdenadorRoutingModule,
  ],
})
export class OrdenadorModule {}
