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
import type {
  DecisionSolicitud,
  RegistroEnvioDecision,
  RegistroValidacionDecision,
  ResultadoValidacion,
} from "../../../models/decision.model";
import { justificacionFinalDecision } from "../../../models/decision.model";
import type { DetalleProveedorOferta } from "../../../models/detalle-proveedor-oferta.model";
import { formatoCop } from "../../../models/necesidad.model";
import type { SolicitudDetalle } from "../../../models/solicitud.model";
import { EvaluacionService } from "../../../services/evaluacion.service";
import {
  DialogoConfirmarDecisionComponent,
  type DialogoConfirmarDecisionDatos,
} from "../dialogo-confirmar-decision/dialogo-confirmar-decision.component";

/** Modos del formulario compartido de decisión. */
export type ModoFichaDecision = "envio" | "validacion" | "lectura";

/** Tono del resumen que pinta la barra de acciones. */
export type TonoResumenDecision = "neutro" | "exito" | "error" | "advertencia";

/**
 * Formulario compartido de decisión.
 *
 * - `envio` (S-11): justificación y notificación para remitir al OG.
 * - `validacion` (O-03): aprobación o rechazo final con respuesta al proveedor.
 * - `lectura` (O-02/O-03): dictamen ya registrado, sin edición.
 *
 * Centraliza el formulario, el mínimo de RN-24, la advertencia de RN-35, la
 * confirmación y la llamada a `EvaluacionService`. La página conserva los
 * permisos, el estado de la vista, la navegación y su barra de acciones.
 */
@Component({
  selector: "app-ficha-decision",
  templateUrl: "./ficha-decision.component.html",
  styleUrls: ["./ficha-decision.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class FichaDecisionComponent implements OnInit {
  private static secuencia = 0;
  private readonly sufijo = `ficha-decision-${FichaDecisionComponent.secuencia++}`;

  private readonly evaluacion = inject(EvaluacionService);
  private readonly dialogo = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly moneda = formatoCop;

  /** Modo del componente. */
  @Input() modo: ModoFichaDecision = "envio";

  /** Expediente con la decisión del solicitante. */
  @Input() solicitud: SolicitudDetalle | null = null;

  /** Oferta seleccionada, con su identidad y documentos. */
  @Input() detalle: DetalleProveedorOferta | null = null;

  /** Decisión ya registrada, para el modo lectura. */
  @Input() decision: DecisionSolicitud | null = null;

  /** Permiso externo de la página (rol, estado, presupuesto). */
  @Input() permitido = true;

  /** Mínimo de caracteres de RN-24. */
  @Input() minimo = MIN_CARACTERES_JUSTIFICACION;

  /** Emite el expediente actualizado después de un registro correcto. */
  @Output() actualizada = new EventEmitter<SolicitudDetalle>();

  readonly enviando = signal(false);
  readonly confirmando = signal(false);
  readonly error = signal("");

  readonly formulario = new FormGroup({
    resultado: new FormControl<ResultadoValidacion | null>(null),
    justificacion: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        justificacionMinima(MIN_CARACTERES_JUSTIFICACION),
      ],
    }),
    notificar: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.formulario.controls.justificacion.setValidators([
      Validators.required,
      justificacionMinima(this.minimo),
    ]);
    this.formulario.controls.justificacion.updateValueAndValidity();

    if (this.modo === "validacion") {
      const control = this.formulario.controls.resultado;
      control.setValidators(Validators.required);
      control.updateValueAndValidity();
    }
  }

  /* ── Identificadores accesibles ────────────────────────────────────────── */

  get idTitulo(): string {
    return `${this.sufijo}-titulo`;
  }

  get idJustificacionEtiqueta(): string {
    return `${this.sufijo}-justificacion-etiqueta`;
  }

  get idJustificacionError(): string {
    return `${this.sufijo}-justificacion-error`;
  }

  get idResultadoError(): string {
    return `${this.sufijo}-resultado-error`;
  }

  get idResultadoEtiqueta(): string {
    return `${this.sufijo}-resultado-etiqueta`;
  }

  /* ── Contexto de la decisión ───────────────────────────────────────────── */

  get esLectura(): boolean {
    return this.modo === "lectura";
  }

  get esValidacion(): boolean {
    return this.modo === "validacion";
  }

  get proveedorNombre(): string {
    return (
      this.detalle?.oferente.proveedor.nombre ??
      this.solicitud?.decision?.proveedorNombre ??
      ""
    );
  }

  get valor(): number {
    return this.detalle?.oferta?.total ?? this.solicitud?.decision?.valor ?? 0;
  }

  get correoProveedor(): string {
    return this.detalle?.oferta?.identidad.correo ?? "";
  }

  get invitacionId(): string {
    return (
      this.detalle?.oferente.invitacion.id ??
      this.solicitud?.decision?.invitacionId ??
      ""
    );
  }

  get ofertaExcedePresupuesto(): boolean {
    return this.detalle?.oferta?.excedePresupuesto ?? false;
  }

  get decisionMostrada(): DecisionSolicitud | null {
    return this.decision ?? this.solicitud?.decision ?? null;
  }

  /* ── Validación del formulario ─────────────────────────────────────────── */

  get textoJustificacion(): string {
    return textoPlanoDesdeHtml(
      this.formulario.controls.justificacion.value,
    ).trim();
  }

  get faltanCaracteres(): number {
    return Math.max(0, this.minimo - this.textoJustificacion.length);
  }

  get mostrarErrorJustificacion(): boolean {
    const control = this.formulario.controls.justificacion;
    return control.invalid && (control.touched || control.dirty);
  }

  get mostrarErrorResultado(): boolean {
    const control = this.formulario.controls.resultado;
    return control.invalid && (control.touched || control.dirty);
  }

  get puedeGuardar(): boolean {
    if (this.esLectura || !this.permitido || this.enviando() || this.confirmando()) {
      return false;
    }
    if (!this.solicitud || !this.detalle?.oferta) {
      return false;
    }
    if (this.formulario.invalid) {
      return false;
    }
    if (this.ofertaExcedePresupuesto) {
      return (
        this.esValidacion &&
        this.formulario.controls.resultado.value === "rechazada"
      );
    }
    return true;
  }

  /** Resumen para la barra inferior de O-03 y el pie de S-11. */
  get resumen(): { texto: string; tono: TonoResumenDecision } {
    if (!this.esValidacion) {
      if (this.faltanCaracteres > 0) {
        return {
          texto: `Justificación incompleta: faltan ${this.faltanCaracteres} caracteres`,
          tono: "error",
        };
      }
      return { texto: "Justificación lista para enviar", tono: "exito" };
    }

    const resultado = this.formulario.controls.resultado.value;
    if (!resultado) {
      return { texto: "Decisión pendiente de registro", tono: "neutro" };
    }
    if (resultado === "aprobada") {
      if (this.ofertaExcedePresupuesto) {
        return {
          texto: "La oferta supera el techo: solo puede rechazarse",
          tono: "error",
        };
      }
      if (this.faltanCaracteres > 0) {
        return {
          texto:
            "Decisión seleccionada: APROBAR cotización · falta completar la " +
            "respuesta y observaciones al proveedor (faltan " +
            this.faltanCaracteres +
            " caracteres) para poder guardar la decisión",
          tono: "error",
        };
      }
      return { texto: "Decisión seleccionada: APROBAR cotización", tono: "exito" };
    }
    if (this.faltanCaracteres > 0) {
      return {
        texto:
          "Decisión seleccionada: RECHAZAR cotización · falta completar la " +
          "respuesta y observaciones al proveedor (faltan " +
          this.faltanCaracteres +
          " caracteres) para poder guardar la decisión",
        tono: "error",
      };
    }
    return { texto: "Decisión seleccionada: RECHAZAR cotización", tono: "error" };
  }

  marcarJustificacionTocada(): void {
    this.formulario.controls.justificacion.markAsTouched();
  }

  marcarResultadoTocado(): void {
    this.formulario.controls.resultado.markAsTouched();
  }

  /**
   * Selecciona la decisión desde toda la tarjeta.
   *
   * El `mat-radio-button` solo escucha su etiqueta interna; la tarjeta tiene
   * padding y zona propia, así que el clic en cualquier punto del elemento
   * fija el valor del formulario.
   */
  seleccionarResultado(resultado: ResultadoValidacion): void {
    if (this.esLectura || this.enviando() || !this.permitido) {
      return;
    }
    this.formulario.controls.resultado.setValue(resultado);
    this.formulario.controls.resultado.markAsTouched();
  }

  /* ── Confirmación y registro ───────────────────────────────────────────── */

  confirmar(): void {
    this.formulario.markAllAsTouched();
    if (!this.puedeGuardar) {
      return;
    }

    this.confirmando.set(true);

    const datos: DialogoConfirmarDecisionDatos = {
      solicitudId: this.solicitud?.id ?? "",
      proveedorNombre: this.proveedorNombre,
      valor: this.valor,
      notificar: this.formulario.controls.notificar.value,
      modo: this.esValidacion ? "validacion" : "envio",
      resultado: this.formulario.controls.resultado.value ?? undefined,
      justificacion: this.textoJustificacion,
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
    const solicitud = this.solicitud;
    const detalle = this.detalle;
    if (!solicitud || !detalle?.oferta || !this.puedeGuardar) {
      return;
    }

    this.error.set("");
    this.enviando.set(true);
    this.formulario.disable();

    const justificacionHtml = this.formulario.controls.justificacion.value;
    const peticion = this.esValidacion
      ? this.evaluacion.validarCotizacion(solicitud, {
          resultado:
            this.formulario.controls.resultado.value ?? "rechazada",
          justificacionHtml,
          notificar: true,
          correoProveedor: this.correoProveedor,
        } satisfies RegistroValidacionDecision)
      : this.evaluacion.enviarAValidacion(solicitud, {
          invitacionId: this.invitacionId,
          proveedorId: detalle.oferente.proveedor.id,
          proveedorNombre: detalle.oferente.proveedor.nombre,
          valor: detalle.oferta.total,
          justificacionHtml,
          notificar: this.formulario.controls.notificar.value,
          correoProveedor: this.correoProveedor,
        } satisfies RegistroEnvioDecision);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
            (this.esValidacion
              ? "No fue posible registrar la decisión de validación. Intente nuevamente."
              : "No fue posible enviar la decisión a validación. Intente nuevamente."),
        );
      },
    });
  }

  /* ── Modo lectura ──────────────────────────────────────────────────────── */

  get etiquetaEstadoLectura(): string {
    const decision = this.decisionMostrada;
    if (!decision) {
      return "Sin decisión registrada";
    }
    if (decision.fase === "aprobada") {
      return "Aprobada por el Ordenador del Gasto";
    }
    if (decision.fase === "rechazada") {
      return "Rechazada por el Ordenador del Gasto";
    }
    return "Enviada a validación";
  }

  get iconoEstadoLectura(): string {
    const decision = this.decisionMostrada;
    if (decision?.fase === "aprobada") {
      return "verified";
    }
    if (decision?.fase === "rechazada") {
      return "cancel";
    }
    return "pending_actions";
  }

  get claseEstadoLectura(): string {
    const decision = this.decisionMostrada;
    if (decision?.fase === "aprobada") {
      return "chip--exito";
    }
    if (decision?.fase === "rechazada") {
      return "chip--error";
    }
    return "chip--advertencia";
  }

  get justificacionLectura(): string {
    const decision = this.decisionMostrada;
    return decision ? justificacionFinalDecision(decision) : "";
  }

  get textoEnvioLectura(): string {
    return this.decisionMostrada?.envio.justificacionHtml ?? "";
  }

  get envioAutorLectura(): string {
    return this.decisionMostrada?.envio.autor ?? "";
  }

  get envioRolLectura(): string {
    return this.decisionMostrada?.envio.rol ?? "";
  }

  get envioFechaLectura(): string {
    return this.decisionMostrada?.envio.fecha ?? "";
  }

  get validacionAutorLectura(): string {
    return this.decisionMostrada?.validacion?.autor ?? "";
  }

  get validacionRolLectura(): string {
    return this.decisionMostrada?.validacion?.rol ?? "";
  }

  get validacionFechaLectura(): string {
    return this.decisionMostrada?.validacion?.fecha ?? "";
  }

  get notificacionLectura(): string {
    return this.decisionMostrada?.envio.notificar
      ? "Programada (simulada)"
      : "No registrada";
  }

  get codigoLectura(): string {
    return this.decisionMostrada?.codigoVerificacion ?? "";
  }

  get validada(): boolean {
    const fase = this.decisionMostrada?.fase;
    return fase === "aprobada" || fase === "rechazada";
  }
}
