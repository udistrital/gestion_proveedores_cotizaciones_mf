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
   * Área exclusiva del Ordenador del Gasto (RN-32).
   */
  {
    path: "bandeja-validacion",
    canMatch: [rolGuard],
    data: { roles: ROLES_ORDENADOR },
    loadChildren: () =>
      import("./ordenador/ordenador.module").then((m) => m.OrdenadorModule),
  },
  /*
   * Alias de O-04: la propuesta nombra la bandeja como `modificaciones-pendientes`
   * y el Root puede enlazarla en cualquiera de las dos formas. Como los
   * redirects se resuelven antes de los guards, la autorización la aplica el
   * `rolGuard` de `validacion`.
   */
  {
    path: "modificaciones-pendientes",
    redirectTo: "validacion/modificaciones-pendientes",
    pathMatch: "full",
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
  /*
   * Fallback para los roles que no son proveedor: si el Root enlaza a
   * "Bandeja de solicitudes", un JD/OG aterriza en su listado en vez de ver un
   * error de ruta.
   */
  {
    path: "bandeja-solicitudes",
    redirectTo: "/cotizaciones/solicitudes",
    pathMatch: "full",
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
