import { Component, Input } from "@angular/core";
import type { ModificacionOrdenador } from "../../../models/modificacion-ordenador.model";

/**
 * Resolución de solo lectura de una modificación (O-04).
 *
 * Presentacional: pinta el acto ya registrado con su justificación saneada
 * (`htmlSeguro`), autor, fecha y efectos sobre la versión y el cierre.
 */
@Component({
  selector: "app-resolucion-modificacion",
  templateUrl: "./resolucion-modificacion.component.html",
  styleUrls: ["./resolucion-modificacion.component.scss"],
  standalone: false,
})
export class ResolucionModificacionComponent {
  @Input({ required: true }) modificacion!: ModificacionOrdenador;

  get aprobada(): boolean {
    return this.modificacion.estado === "aprobada";
  }

  get decision() {
    return this.modificacion.decision;
  }

  get cierreVisible(): string {
    const decision = this.decision;
    if (!decision) {
      return "—";
    }
    return this.aprobada
      ? decision.cierreVigente || "Sin cambio de fecha"
      : "Sin cambios";
  }

  get notificacionVisible(): string {
    const notificados = this.decision?.notificados ?? 0;
    if (notificados === 0) {
      return "Sin notificación registrada";
    }
    return notificados === 1
      ? "1 cotizante notificado (simulada)"
      : `${notificados} cotizantes notificados (simulada)`;
  }
}
