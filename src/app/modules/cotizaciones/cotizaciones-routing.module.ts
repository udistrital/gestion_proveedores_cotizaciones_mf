import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import {
  entradaCotizacionesGuard,
  rolGuard,
} from "src/app/core/_guards/rol.guard";
import {
  ROLES_ORDENADOR,
  ROL_PROVEEDOR,
  ROLES_SOLICITANTE,
} from "src/app/core/constants/roles.const";
import { EntradaCotizacionesComponent } from "./pages/entrada-cotizaciones/entrada-cotizaciones.component";

const routes: Routes = [
  {
    path: "estudios-mercado",
    canMatch: [rolGuard],
    data: { roles: ROLES_SOLICITANTE },
    loadChildren: () =>
      import(
        "./solicitante/pages/estudios-mercado/estudios-mercado.module"
      ).then((m) => m.EstudiosMercadoModule),
  },
  {
    path: "solicitudes",
    canMatch: [rolGuard],
    data: { roles: ROLES_SOLICITANTE },
    loadChildren: () =>
      import("./solicitante/solicitante.module").then(
        (m) => m.SolicitanteModule,
      ),
  },
  /*
   * Área exclusiva del Ordenador del Gasto.
   */
  {
    path: "bandeja-validacion",
    canMatch: [rolGuard],
    data: { roles: ROLES_ORDENADOR },
    loadChildren: () =>
      import("./ordenador/ordenador.module").then((m) => m.OrdenadorModule),
  },
  /*
   * El orden importa: esta ruta debe evaluarse ANTES del redirect de
   * `bandeja-solicitudes`. Si el redirect va primero, captura la URL con
   * `pathMatch: "full"` y manda al proveedor al área solicitante, donde el
   * `rolGuard` lo rechaza y la bandeja queda inalcanzable.
   */
  {
    path: "bandeja-solicitudes",
    canMatch: [rolGuard],
    data: { roles: [ROL_PROVEEDOR] },
    loadChildren: () =>
      import("./proveedor/proveedor.module").then(
        (m) => m.ProveedorModule,
      ),
  },
  {
    path: "",
    pathMatch: "full",
    canActivate: [entradaCotizacionesGuard],
    component: EntradaCotizacionesComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CotizacionesRoutingModule {}
