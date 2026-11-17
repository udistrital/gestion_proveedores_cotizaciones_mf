import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type { ResultadoValidacion } from "../../../models/decision.model";
import { formatoCop } from "../../../models/necesidad.model";

/** Modo del diálogo: envío a validación (S-11) o validación final (O-03). */
export type ModoDialogoDecision = "envio" | "validacion";

/** Datos que la confirmación recibe de la página. */
export interface DialogoConfirmarDecisionDatos {
  readonly solicitudId: string;
  readonly proveedorNombre: string;
  readonly valor: number;
  readonly notificar: boolean;
  /** `envio` por defecto, para conservar S-11. */
  readonly modo?: ModoDialogoDecision;
  /** Solo en modo `validacion`. */
  readonly resultado?: ResultadoValidacion;
  /** Texto plano de la respuesta, para el resumen. */
  readonly justificacion?: string;
}

/**
 * Confirmación del envío a validación (S-11) y de la validación final (O-03).
 *
 * Advierte que la acción es única y definitiva (RN-35) y resume la oferta y la
 * decisión. No ejecuta el registro: la página conserva el formulario y el texto
 * si el servicio falla.
 */
@Component({
  selector: "app-dialogo-confirmar-decision",
  templateUrl: "./dialogo-confirmar-decision.component.html",
  styleUrls: ["./dialogo-confirmar-decision.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DialogoConfirmarDecisionComponent {
  readonly moneda = formatoCop;

  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoConfirmarDecisionComponent,
      boolean
    >,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoConfirmarDecisionDatos,
  ) {}

  /** true cuando se está confirmando la aprobación o el rechazo final. */
  get esValidacion(): boolean {
    return this.datos.modo === "validacion";
  }

  get aprobada(): boolean {
    return this.datos.resultado === "aprobada";
  }

  get titulo(): string {
    if (!this.esValidacion) {
      return "¿Enviar la decisión a validación?";
    }
    return this.aprobada
      ? "¿Confirma que desea APROBAR la cotización?"
      : "¿Confirma que desea RECHAZAR la cotización?";
  }

  get sello(): string {
    return this.esValidacion
      ? "Acto administrativo definitivo"
      : "Confirmación de trámite único";
  }

  get icono(): string {
    if (!this.esValidacion) {
      return "send";
    }
    return this.aprobada ? "verified" : "cancel";
  }

  get subtitulo(): string {
    return this.esValidacion
      ? "La decisión del Ordenador del Gasto es única y no admite cambios posteriores."
      : "La oferta seleccionada quedará a la espera de la decisión del Ordenador del Gasto.";
  }

  get etiquetaResultado(): string {
    return this.aprobada ? "APRUEBA (Favorable)" : "RECHAZA (Desfavorable)";
  }

  get textoBoton(): string {
    if (!this.esValidacion) {
      return "Confirmar y enviar";
    }
    return this.aprobada ? "Confirmar aprobación" : "Confirmar rechazo";
  }

  get textoCancelar(): string {
    return this.esValidacion ? "Volver" : "Cancelar y revisar";
  }

  /** Texto plano de la respuesta, resumido para la confirmación. */
  get justificacionCorta(): string {
    const texto = (this.datos.justificacion ?? "").trim();
    if (texto.length <= 220) {
      return texto;
    }
    return `${texto.slice(0, 217)}…`;
  }

  confirmar(): void {
    this.dialogRef.close(true);
  }

  cancelar(): void {
    this.dialogRef.close(false);
  }
}
