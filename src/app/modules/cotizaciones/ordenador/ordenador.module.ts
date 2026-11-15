import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { BandejaValidacionComponent } from "./pages/bandeja-validacion/bandeja-validacion.component";
import { PantallaOrdenadorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-ordenador-placeholder.component";
import { OrdenadorRoutingModule } from "./ordenador-routing.module";

/**
 * Área lazy exclusiva del Ordenador del Gasto (RN-32).
 *
 * `SolicitudesService` llega desde `CotizacionesModule`, que es el único punto
 * de enlace con la implementación simulada (y, mañana, con HTTP).
 */
@NgModule({
  declarations: [
    BandejaValidacionComponent,
    PantallaOrdenadorPlaceholderComponent,
  ],
  imports: [CommonModule, SharedModule, OrdenadorRoutingModule],
})
export class OrdenadorModule {}
