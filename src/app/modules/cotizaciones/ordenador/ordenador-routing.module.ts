import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { BandejaValidacionComponent } from "./pages/bandeja-validacion/bandeja-validacion.component";
import { PantallaOrdenadorPlaceholderComponent } from "./pages/pantalla-proximamente/pantalla-ordenador-placeholder.component";
import { ResultadoValidacionComponent } from "./pages/resultado-validacion/resultado-validacion.component";
import { ValidarCotizacionComponent } from "./pages/validar-cotizacion/validar-cotizacion.component";
import { resultadoValidacionResolver } from "./resolvers/resultado-validacion.resolver";

/**
 * Rutas del área del Ordenador del Gasto (O-01 a O-04).
 *
 * El módulo se monta en `cotizaciones/bandeja-validacion` (RN-32). Los literales van
 * antes de `:id` para que la bandeja de modificaciones no sea capturada por
 * una ruta de detalle.
 */
const routes: Routes = [
  {
    path: "",
    component: BandejaValidacionComponent,
    title: "ÁGORA · Pendientes de validación",
  },
  {
    path: "modificaciones-pendientes",
    component: PantallaOrdenadorPlaceholderComponent,
    title: "ÁGORA · Modificaciones por aprobar",
    data: {
      titulo: "Modificaciones por aprobar",
      pantalla: "O-04",
    },
  },
  {
    path: "modificaciones-pendientes/:id",
    component: PantallaOrdenadorPlaceholderComponent,
    title: "ÁGORA · Decidir modificación",
    data: {
      titulo: "Decidir modificación",
      pantalla: "O-04",
    },
  },
  {
    path: ":id/resultado",
    component: ResultadoValidacionComponent,
    resolve: { resultado: resultadoValidacionResolver },
    title: "ÁGORA · Resultado de la solicitud",
  },
  {
    path: ":id/validar",
    component: ValidarCotizacionComponent,
    title: "ÁGORA · Validar cotización vinculada",
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrdenadorRoutingModule {}
