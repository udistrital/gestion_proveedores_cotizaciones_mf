import {
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import type { EstadoModificacionOrdenador } from "src/app/core/constants/estados-solicitud.const";
import {
  cambiosDelPaso,
  etiquetaTipoCambio,
  pasosProcesoModificacion,
  tipoCambioModificacion,
  type ModificacionOrdenador,
} from "../../../models/modificacion-ordenador.model";
import {
  etiquetaUnidadEjecutora,
  type SolicitudDetalle,
} from "../../../models/solicitud.model";
import { FichaDecisionModificacionComponent } from "../../../components/decision/ficha-decision-modificacion/ficha-decision-modificacion.component";
import { ModificacionesService } from "../../../services/modificaciones.service";
import { SolicitudesService } from "../../../services/solicitudes.service";

/** Estados de vista de la decisión de una modificación (O-04). */
export type EstadoVistaModificacion =
  | "cargando"
  | "error"
  | "no-encontrada"
  | "sin-acceso"
  | "sin-permiso"
  | "pendiente"
  | "decidida";

/**
 * Decisión sobre una solicitud de modificación (O-04).
 *
 * Reutiliza el cálculo de diferencias de S-04, el comparativo compartido y la
 * resolución de solo lectura. La escritura se delega en
 * `ModificacionesService`; la vista nunca decide por su cuenta.
 *
 * Trucos de desarrollo:
 * - `?mockModificacion=error|no-encontrada|no-asignada|error-guardado`.
 * - `?mockModificacion=mismo-usuario` → aviso de segregación funcional.
 * - `?mockRetardo=2500`.
 */
@Component({
  selector: "app-decidir-modificacion",
  templateUrl: "./decidir-modificacion.component.html",
  styleUrls: ["./decidir-modificacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DecidirModificacionComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(ModificacionesService);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(FichaDecisionModificacionComponent)
  ficha?: FichaDecisionModificacionComponent;

  readonly vista = signal<EstadoVistaModificacion>("cargando");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly modificacion = signal<ModificacionOrdenador | null>(null);
  readonly mensajeError = signal("");
  readonly anuncio = signal("");
  readonly mismoUsuario = signal(false);

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › Modificaciones por aprobar › <b>Decidir modificación</b></p>";

  private id = "";

  readonly pasos = computed(() => {
    const modificacion = this.modificacion();
    return modificacion
      ? pasosProcesoModificacion(modificacion.estado)
      : [];
  });

  readonly estadoChip = computed<EstadoModificacionOrdenador | null>(
    () => this.modificacion()?.estado ?? null,
  );

  get propuesta() {
    return this.modificacion()?.propuesta ?? null;
  }

  get tipoCambioTexto(): string {
    const modificacion = this.modificacion();
    return modificacion ? etiquetaTipoCambio(modificacion.tipoCambio) : "";
  }

  get responsable(): string {
    const general = this.solicitud()?.general;
    return general
      ? `${general.responsable.nombres} ${general.responsable.apellidos}`.trim()
      : "—";
  }

  get identificacion(): string {
    return this.solicitud()?.general.responsable.identificacion ?? "—";
  }

  get unidadEjecutora(): string {
    const solicitud = this.solicitud();
    return solicitud
      ? etiquetaUnidadEjecutora(solicitud.unidadEjecutora)
      : "—";
  }

  get ordenadorCompetente(): string {
    const responsable = this.solicitud()?.general.responsable;
    return responsable
      ? `${responsable.ordenadorGasto} ${responsable.ordenadorCargo}`
      : "—";
  }

  get cierreActual(): string {
    const modificacion = this.modificacion();
    if (!modificacion) {
      return "—";
    }
    return modificacion.estado === "aprobada"
      ? (modificacion.cierrePropuesto ?? modificacion.cierreVigente ?? "—")
      : (modificacion.cierreVigente ?? "—");
  }

  get cierreVigente(): string {
    return this.modificacion()?.cierreVigente ?? "—";
  }

  get cierrePropuesto(): string {
    return this.modificacion()?.cierrePropuesto ?? "—";
  }

  get cambiaCierre(): boolean {
    return (this.modificacion()?.cambiosCierre ?? 0) > 0;
  }

  get cambiaItems(): boolean {
    return (this.modificacion()?.cambiosItems ?? 0) > 0;
  }

  get notificados(): number {
    return this.solicitud()?.cotizacionesRecibidas ?? 0;
  }

  get puedeConfirmar(): boolean {
    return this.ficha?.puedeGuardar ?? false;
  }

  get resumenDecision(): {
    texto: string;
    tono: "neutro" | "exito" | "error" | "advertencia";
  } {
    return (
      this.ficha?.resumen ?? {
        texto: "Sin selección (pendiente)",
        tono: "neutro",
      }
    );
  }

  ngOnInit(): void {
    this.id = this.ruta.snapshot.paramMap.get("id") ?? "";
    this.cargar();
  }

  /* ── Carga ─────────────────────────────────────────────────────────────── */

  cargar(): void {
    this.vista.set("cargando");
    this.mensajeError.set("");
    this.modificacion.set(null);

    this.servicio
      .obtener(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (consulta) => {
          if (consulta.estado === "no-encontrada") {
            this.vista.set("no-encontrada");
            return;
          }
          if (consulta.estado === "no-asignada") {
            this.vista.set("sin-acceso");
            this.anuncio.set(
              "La modificación está asignada a otro despacho del ordenador del gasto.",
            );
            return;
          }
          if (!this.permisos.puedeAccederModificaciones()) {
            this.vista.set("sin-permiso");
            this.anuncio.set(
              "Las modificaciones por aprobar están restringidas al ordenador del gasto (RN-32).",
            );
            return;
          }

          this.solicitud.set(consulta.solicitud);
          this.modificacion.set(consulta.modificacion);
          this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Modificaciones por aprobar › <b>${consulta.modificacion.radicado}</b></p>`;
          this.mismoUsuario.set(this.esMismoUsuario(consulta.modificacion));
          this.vista.set(
            consulta.modificacion.estado === "por-aprobar"
              ? "pendiente"
              : "decidida",
          );
        },
        error: (fallo: Error) => {
          this.mensajeError.set(
            fallo.message ||
              "No fue posible consultar la modificación. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  private esMismoUsuario(modificacion: ModificacionOrdenador): boolean {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockModificacion") === "mismo-usuario") {
      return true;
    }
    return this.solicitudes.esSolicitanteOrdenadorSesion(
      modificacion.propuesta.solicitadaPor,
    );
  }

  /* ── Acciones ──────────────────────────────────────────────────────────── */

  confirmar(): void {
    this.ficha?.confirmar();
  }

  alDecidir(actualizada: SolicitudDetalle): void {
    this.solicitud.set(actualizada);
    const actual = this.modificacion();
    const resuelta = actualizada.modificacionesResueltas?.find(
      (item) => item.radicado === actual?.radicado,
    );
    if (actual && resuelta) {
      this.modificacion.set({
        ...actual,
        estado: resuelta.estado,
        decision: resuelta.decision,
        resueltaEl: resuelta.resueltaEl,
        diferencias: resuelta.diferencias,
        tipoCambio: tipoCambioModificacion(resuelta.diferencias),
        cierrePropuesto: resuelta.decision.cierreVigente,
        cambiosItems: cambiosDelPaso(resuelta.diferencias, 3),
        cambiosCierre: cambiosDelPaso(resuelta.diferencias, 2),
      });
    }
    this.vista.set("decidida");
    this.anuncio.set(
      "La decisión quedó registrada y la modificación pasó a solo lectura.",
    );
  }

  reintentar(): void {
    this.cargar();
  }

  /* ── Navegación ────────────────────────────────────────────────────────── */

  volver(): void {
    void this.router.navigate([
      "/cotizaciones",
      "bandeja-validacion",
      "modificaciones-pendientes",
    ]);
  }

  verExpediente(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate(["/cotizaciones", "solicitudes", solicitud.id]);
    }
  }

  abrirHistorial(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "historial",
      ]);
    }
  }
}
