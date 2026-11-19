import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import type { ResultadoValidacion } from "../../../models/decision.model";
import { formatoCop } from "../../../models/necesidad.model";

/** Modo del diálogo: envío a validación (S-11), validación (O-03) o modificación (O-04). */
export type ModoDialogoDecision =
  | "envio"
  | "validacion"
  | "modificacion";

/** Datos que la confirmación recibe de la página. */
export interface DialogoConfirmarDecisionDatos {
  readonly solicitudId: string;
  readonly proveedorNombre: string;
  readonly valor: number;
  readonly notificar: boolean;
  /** `envio` por defecto, para conservar S-11. */
  readonly modo?: ModoDialogoDecision;
  /** Solo en modo `validacion` y `modificacion`. */
  readonly resultado?: ResultadoValidacion;
  /** Texto plano de la respuesta, para el resumen. */
  readonly justificacion?: string;
  /** Solo en modo `modificacion`. */
  readonly modificacionId?: string;
  readonly tipoCambio?: string;
  readonly cierreVigente?: string | null;
  readonly cierrePropuesto?: string | null;
  readonly notificados?: number;
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

  /** true cuando se decide una solicitud de modificación (O-04). */
  get esModificacion(): boolean {
    return this.datos.modo === "modificacion";
  }

  /** true en las decisiones únicas y definitivas (O-03 y O-04). */
  get esDecisionFinal(): boolean {
    return this.esValidacion || this.esModificacion;
  }

  get aprobada(): boolean {
    return this.datos.resultado === "aprobada";
  }

  get titulo(): string {
    if (this.esModificacion) {
      return this.aprobada
        ? "¿Confirma que desea APROBAR la solicitud de modificación?"
        : "¿Confirma que desea RECHAZAR la solicitud de modificación?";
    }
    if (!this.esValidacion) {
      return "¿Enviar la decisión a validación?";
    }
    return this.aprobada
      ? "¿Confirma que desea APROBAR la cotización?"
      : "¿Confirma que desea RECHAZAR la cotización?";
  }

  get sello(): string {
    return this.esDecisionFinal
      ? "Acto administrativo definitivo"
      : "Confirmación de trámite único";
  }

  get icono(): string {
    if (this.esModificacion) {
      return this.aprobada ? "verified" : "cancel";
    }
    if (!this.esValidacion) {
      return "send";
    }
    return this.aprobada ? "verified" : "cancel";
  }

  get subtitulo(): string {
    if (this.esModificacion) {
      return this.aprobada
        ? "Se emitirá la adenda y la nueva versión de la solicitud. La decisión del Ordenador del Gasto es única y no admite cambios posteriores."
        : "Se conservará la versión vigente y el solicitante verá el rechazo. La decisión es única y no admite cambios posteriores.";
    }
    return this.esValidacion
      ? "La decisión del Ordenador del Gasto es única y no admite cambios posteriores."
      : "La oferta seleccionada quedará a la espera de la decisión del Ordenador del Gasto.";
  }

  get etiquetaResultado(): string {
    if (this.esModificacion) {
      return this.aprobada
        ? "APRUEBA LA MODIFICACIÓN"
        : "RECHAZA LA MODIFICACIÓN";
    }
    return this.aprobada ? "APRUEBA (Favorable)" : "RECHAZA (Desfavorable)";
  }

  get textoBoton(): string {
    if (!this.esDecisionFinal) {
      return "Confirmar y enviar";
    }
    return this.aprobada ? "Confirmar aprobación" : "Confirmar rechazo";
  }

  get textoCancelar(): string {
    return this.esDecisionFinal ? "Volver" : "Cancelar y revisar";
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
