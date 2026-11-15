import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

/**
 * Placeholder de las pantallas del ordenador que aún no pertenecen a esta
 * entrega (O-02, O-03 y O-04).
 *
 * No inventa rutas ni datos: muestra el título de la pantalla, una etiqueta
 * «Por definir» y el regreso a la bandeja de validación.
 */
@Component({
  selector: "app-pantalla-ordenador-placeholder",
  templateUrl: "./pantalla-ordenador-placeholder.component.html",
  styleUrls: ["./pantalla-ordenador-placeholder.component.scss"],
  standalone: false,
})
export class PantallaOrdenadorPlaceholderComponent {
  readonly titulo: string;
  readonly pantalla: string;
  readonly solicitudId: string;
  readonly breadcrumb =
    "<p>Cotizaciones › Despacho Ordenador del Gasto › <b>Pendientes de validación</b></p>";

  constructor(route: ActivatedRoute) {
    const datos = route.snapshot.data;
    this.titulo = datos["titulo"] ?? "Pantalla por implementar";
    this.pantalla = datos["pantalla"] ?? "O-00";
    this.solicitudId = route.snapshot.paramMap.get("id") ?? "";
  }
}
