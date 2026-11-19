import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { MatDialog } from "@angular/material/dialog";
import {
  MIN_CARACTERES_JUSTIFICACION,
  justificacionMinima,
} from "src/app/shared/validators/justificacion.validator";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";
import type { ResultadoValidacion } from "../../../models/decision.model";
import {
  etiquetaTipoCambio,
  type ModificacionOrdenador,
} from "../../../models/modificacion-ordenador.model";
import type { SolicitudDetalle } from "../../../models/solicitud.model";
import { ModificacionesService } from "../../../services/modificaciones.service";
import {
  DialogoConfirmarDecisionComponent,
  type DialogoConfirmarDecisionDatos,
} from "../dialogo-confirmar-decision/dialogo-confirmar-decision.component";

/** Tono del resumen que pinta la barra de acciones. */
export type TonoResumenModificacion =
  | "neutro"
  | "exito"
  | "error"
  | "advertencia";

/**
 * Formulario de decisión de una modificación (O-04).
 *
 * Es hermano de `FichaDecisionComponent`: comparte el editor, el validador de
 * RN-24, el diálogo de confirmación y la llamada al servicio, pero su contrato
 * es la modificación (no la oferta) y la justificación es opcional al aprobar y
 * obligatoria al rechazar (provisional, según el mockup O-05).
 */
@Component({
  selector: "app-ficha-decision-modificacion",
  templateUrl: "./ficha-decision-modificacion.component.html",
  styleUrls: ["./ficha-decision-modificacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class FichaDecisionModificacionComponent implements OnInit {
  private static secuencia = 0;
  private readonly sufijo = `ficha-modificacion-${FichaDecisionModificacionComponent.secuencia++}`;

  private readonly servicio = inject(ModificacionesService);
  private readonly dialogo = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  /** Modificación que se está decidiendo. */
  @Input({ required: true }) modificacion!: ModificacionOrdenador;

  /** Permiso externo de la página (rol y estado). */
  @Input() permitido = true;

  /** Mínimo de caracteres del rechazo (RN-24 por analogía, provisional). */
  @Input() minimo = MIN_CARACTERES_JUSTIFICACION;

  /** Cotizantes que recibirían la notificación simulada (RF-13). */
  @Input() notificados = 0;

  /** Emite el expediente actualizado después de un registro correcto. */
  @Output() actualizada = new EventEmitter<SolicitudDetalle>();

  readonly enviando = signal(false);
  readonly confirmando = signal(false);
  readonly error = signal("");

  readonly formulario = new FormGroup({
    resultado: new FormControl<ResultadoValidacion | null>(null),
    justificacion: new FormControl("", { nonNullable: true }),
  });

  ngOnInit(): void {
    this.formulario.controls.resultado.addValidators(Validators.required);
    this.formulario.controls.resultado.updateValueAndValidity({
      emitEvent: false,
    });
  }

  /* ── Identificadores accesibles ────────────────────────────────────────── */

  get idTitulo(): string {
    return `${this.sufijo}-titulo`;
  }

  get idResultadoEtiqueta(): string {
    return `${this.sufijo}-resultado-etiqueta`;
  }

  get idResultadoError(): string {
    return `${this.sufijo}-resultado-error`;
  }

  get idJustificacionEtiqueta(): string {
    return `${this.sufijo}-justificacion-etiqueta`;
  }

  get idJustificacionError(): string {
    return `${this.sufijo}-justificacion-error`;
  }

  /* ── Estado del formulario ─────────────────────────────────────────────── */

  get resultado(): ResultadoValidacion | null {
    return this.formulario.controls.resultado.value;
  }

  get esRechazo(): boolean {
    return this.resultado === "rechazada";
  }

  get etiquetaTipoCambio(): string {
    return etiquetaTipoCambio(this.modificacion.tipoCambio);
  }

  get textoJustificacion(): string {
    return textoPlanoDesdeHtml(
      this.formulario.controls.justificacion.value,
    ).trim();
  }

  get faltanCaracteres(): number {
    return Math.max(0, this.minimo - this.textoJustificacion.length);
  }

  get mostrarErrorResultado(): boolean {
    const control = this.formulario.controls.resultado;
    return control.invalid && (control.touched || control.dirty);
  }

  get mostrarErrorJustificacion(): boolean {
    const control = this.formulario.controls.justificacion;
    return (
      this.esRechazo &&
      control.invalid &&
      (control.touched || control.dirty)
    );
  }

  get puedeGuardar(): boolean {
    return (
      this.permitido &&
      !this.enviando() &&
      !this.confirmando() &&
      this.formulario.valid
    );
  }

  /** Resumen de la barra inferior de O-04. */
  get resumen(): { texto: string; tono: TonoResumenModificacion } {
    if (!this.resultado) {
      return { texto: "Sin selección (pendiente)", tono: "neutro" };
    }
    if (this.resultado === "aprobada") {
      return {
        texto: "Decisión seleccionada: APROBAR modificación",
        tono: "exito",
      };
    }
    if (this.faltanCaracteres > 0) {
      return {
        texto: `Decisión seleccionada: RECHAZAR modificación · faltan ${this.faltanCaracteres} caracteres para poder guardar`,
        tono: "error",
      };
    }
    return {
      texto: "Decisión seleccionada: RECHAZAR modificación",
      tono: "error",
    };
  }

  marcarResultadoTocado(): void {
    this.formulario.controls.resultado.markAsTouched();
    this.actualizarValidadores();
    if (this.esRechazo) {
      this.formulario.controls.justificacion.markAsTouched();
    }
  }

  marcarJustificacionTocada(): void {
    this.formulario.controls.justificacion.markAsTouched();
  }

  /** Selecciona la decisión desde toda la tarjeta. */
  seleccionarResultado(resultado: ResultadoValidacion): void {
    if (this.enviando() || !this.permitido) {
      return;
    }
    this.formulario.controls.resultado.setValue(resultado);
    this.marcarResultadoTocado();
  }

  /** Cambia el control: la justificación solo es obligatoria al rechazar. */
  private actualizarValidadores(): void {
    const control = this.formulario.controls.justificacion;
    if (this.esRechazo) {
      control.setValidators([
        Validators.required,
        justificacionMinima(this.minimo),
      ]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  /* ── Confirmación y registro ───────────────────────────────────────────── */

  confirmar(): void {
    this.formulario.markAllAsTouched();
    if (!this.puedeGuardar) {
      return;
    }

    this.confirmando.set(true);
    const datos: DialogoConfirmarDecisionDatos = {
      solicitudId: this.modificacion.solicitud.id,
      proveedorNombre: "",
      valor: 0,
      notificar: true,
      modo: "modificacion",
      resultado: this.resultado ?? undefined,
      justificacion: this.textoJustificacion,
      modificacionId: this.modificacion.radicado,
      tipoCambio: this.etiquetaTipoCambio,
      cierreVigente: this.modificacion.cierreVigente,
      cierrePropuesto: this.modificacion.cierrePropuesto,
      notificados: this.notificados,
    };

    this.dialogo
      .open<
        DialogoConfirmarDecisionComponent,
        DialogoConfirmarDecisionDatos,
        boolean
      >(DialogoConfirmarDecisionComponent, {
        data: datos,
        width: "34rem",
        maxWidth: "96vw",
        autoFocus: ".dialogo__cancelar",
        restoreFocus: true,
        ariaLabelledBy: "dialogo-decision-titulo",
        ariaDescribedBy: "dialogo-decision-descripcion",
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmado) => {
        this.confirmando.set(false);
        if (confirmado) {
          this.ejecutar();
        }
      });
  }

  reintentar(): void {
    this.ejecutar();
  }

  private ejecutar(): void {
    if (!this.puedeGuardar || !this.resultado) {
      return;
    }

    this.error.set("");
    this.enviando.set(true);
    this.formulario.disable();

    this.servicio
      .decidir(this.modificacion.radicado, {
        resultado: this.resultado,
        justificacionHtml: this.formulario.controls.justificacion.value,
        notificar: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (actualizada) => {
          this.enviando.set(false);
          this.formulario.enable();
          this.actualizada.emit(actualizada);
        },
        error: (fallo: Error) => {
          this.enviando.set(false);
          this.formulario.enable();
          this.error.set(
            fallo.message ||
              "No fue posible registrar la decisión. Intente nuevamente.",
          );
        },
      });
  }
}
