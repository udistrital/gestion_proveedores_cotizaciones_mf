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
import { MatDialog } from "@angular/material/dialog";
import { ActivatedRoute, Router } from "@angular/router";
import { Subscription, interval } from "rxjs";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { AlertService } from "src/app/shared/services/alert.service";
import type { EstadoValidacionOrdenador } from "src/app/core/constants/estados-solicitud.const";
import {
  resultadoDecisionSolicitud,
  type DecisionSolicitud,
} from "../../../models/decision.model";
import type { DetalleProveedorOferta } from "../../../models/detalle-proveedor-oferta.model";
import { formatoCop } from "../../../models/necesidad.model";
import {
  identidadProveedor,
  type IdentidadProveedor,
} from "../../../models/proveedores.model";
import {
  etiquetaTipoCotizacion,
  etiquetaUnidadEjecutora,
  type SolicitudDetalle,
} from "../../../models/solicitud.model";
import { pasosProcesoValidacion } from "../../../models/resultado-validacion-ordenador.model";
import { estadoVistaResultadoValidacion } from "../../../models/resultado-validacion-ordenador.model";
import {
  estadoVistaValidarCotizacion,
  type EstadoValidarCotizacion,
} from "../../../models/validacion-cotizacion.model";
import { FichaDecisionComponent } from "../../../components/decision/ficha-decision/ficha-decision.component";
import {
  DialogoDetalleOfertaValidacionComponent,
  type DialogoDetalleOfertaDatos,
  type VistaDetalleOferta,
} from "../../components/dialogo-detalle-oferta-validacion/dialogo-detalle-oferta-validacion.component";
import { OferentesService } from "../../../services/oferentes.service";
import { SolicitudesService } from "../../../services/solicitudes.service";

/**
 * Validación final de la cotización (O-03).
 *
 * Es la única pantalla del módulo que aprueba o rechaza la cotización
 * seleccionada. S-11 solo registra la respuesta y el envío a validación; O-02
 * consulta el resultado.
 *
 * Reutiliza el formulario compartido `FichaDecisionComponent` (formulario,
 * confirmación y registro), la oferta de S-10 y el comparativo de S-09. La
 * vista es de solo lectura cuando la decisión ya fue registrada (RN-35).
 *
 * Trucos de desarrollo (query params, sin tocar código):
 * - `?mockValidacion=error` → falla la carga del expediente.
 * - `?mockValidacion=no-encontrada` → identificador inexistente.
 * - `?mockValidacion=no-asignada` → solicitud de otro despacho.
 * - `?mockValidacion=sin-oferta` → decisión sin oferta consultable.
 * - `?mockValidacion=mismo-usuario` → aviso de segregación funcional.
 * - `?mockValidacion=error-guardado` → falla el registro de la decisión.
 * - `?mockRetardo=2500` → retardo en ms.
 */
@Component({
  selector: "app-validar-cotizacion",
  templateUrl: "./validar-cotizacion.component.html",
  styleUrls: ["./validar-cotizacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class ValidarCotizacionComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudes = inject(SolicitudesService);
  private readonly oferentes = inject(OferentesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly dialogo = inject(MatDialog);
  private readonly alerta = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(FichaDecisionComponent) ficha?: FichaDecisionComponent;

  readonly moneda = formatoCop;

  readonly vista = signal<EstadoValidarCotizacion>("cargando");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly detalle = signal<DetalleProveedorOferta | null>(null);
  readonly mensajeError = signal("");
  readonly anuncio = signal("");
  readonly mismoUsuario = signal(false);

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Validar cotización vinculada</b></p>";

  private id = "";
  private vigiaCierre?: Subscription;

  readonly decision = computed<DecisionSolicitud | null>(
    () => this.solicitud()?.decision ?? null,
  );

  readonly oferta = computed(() => this.detalle()?.oferta ?? null);

  readonly identidad = computed<IdentidadProveedor | null>(() => {
    const detalle = this.detalle();
    if (!detalle) {
      return null;
    }
    return (
      detalle.oferta?.identidad ?? identidadProveedor(detalle.oferente.proveedor)
    );
  });

  readonly pasos = computed(() => {
    const solicitud = this.solicitud();
    return solicitud ? pasosProcesoValidacion(solicitud) : [];
  });

  readonly resultado = computed(() => {
    const solicitud = this.solicitud();
    return solicitud ? resultadoDecisionSolicitud(solicitud) : null;
  });

  readonly estadoChipValidacion = computed<
    EstadoValidacionOrdenador | null
  >(() => {
    const decision = this.decision();
    if (!decision) {
      return null;
    }
    if (decision.fase === "aprobada") {
      return "validada-aprobada";
    }
    if (decision.fase === "rechazada") {
      return "validada-rechazada";
    }
    return "por-validar";
  });

  readonly resumenDocumentos = computed(() => {
    const documentos = this.detalle()?.documentos ?? [];
    return {
      total: documentos.length,
      cargados: documentos.filter(
        (documento) =>
          documento.estado === "cargado" ||
          documento.estado === "subsanado",
      ).length,
    };
  });

  get ahorroPorcentaje(): number {
    const oferta = this.oferta();
    if (!oferta || oferta.valorPresupuesto <= 0) {
      return 0;
    }
    return (oferta.ahorro / oferta.valorPresupuesto) * 100;
  }

  get excedePresupuesto(): boolean {
    return this.oferta()?.excedePresupuesto ?? false;
  }

  get puedeConfirmar(): boolean {
    return this.ficha?.puedeGuardar ?? false;
  }

  get resumenDecision(): { texto: string; tono: string } {
    return (
      this.ficha?.resumen ?? {
        texto: "Decisión pendiente de registro",
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
    this.detalle.set(null);
    this.vigiaCierre?.unsubscribe();

    this.solicitudes
      .obtenerValidacionOrdenador(this.id)
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
              "La solicitud está asignada a otro despacho del ordenador del gasto.",
            );
            return;
          }
          if (!this.permisos.puedeAccederValidaciones()) {
            this.vista.set("sin-acceso");
            this.anuncio.set(
              "La validación de cotizaciones está restringida al ordenador del gasto.",
            );
            return;
          }

          const solicitud = consulta.solicitud;
          this.solicitud.set(solicitud);
          this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Solicitud ${solicitud.id} › <b>Validar cotización vinculada</b></p>`;
          this.mismoUsuario.set(this.esMismoUsuario(solicitud));

          const estado = this.estadoBase(solicitud);
          if (estado === "bloqueado") {
            this.vista.set("bloqueado");
            this.anuncio.set(
              "La validación se habilita cuando termine el periodo de cotización.",
            );
            this.vigilarCierre();
            return;
          }
          if (estado === "no-disponible") {
            this.vista.set("no-disponible");
            return;
          }
          if (estado === "sin-decision") {
            this.vista.set("sin-decision");
            this.anuncio.set(
              "El solicitante aún no ha registrado su decisión.",
            );
            return;
          }
          if (estado === "decidida") {
            this.cargarOferta(solicitud, "decidida");
            return;
          }
          this.cargarOferta(solicitud, "pendiente");
        },
        error: (fallo: Error) => {
          this.mensajeError.set(
            fallo.message ||
              "No fue posible consultar el expediente de la validación. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  private estadoBase(
    solicitud: SolicitudDetalle,
  ): EstadoValidarCotizacion {
    return estadoVistaResultadoValidacion(solicitud);
  }

  private cargarOferta(
    solicitud: SolicitudDetalle,
    estado: "pendiente" | "decidida",
  ): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockValidacion") === "sin-oferta") {
      this.detalle.set(null);
      this.vista.set(estado === "pendiente" ? "sin-proveedor" : estado);
      return;
    }

    this.oferentes
      .obtenerOfertaSeleccionada(solicitud)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          this.detalle.set(detalle);
          const estadoFinal = estadoVistaValidarCotizacion(
            solicitud,
            !!detalle?.oferta,
          );
          this.vista.set(estadoFinal);
        },
        error: (fallo: Error) => {
          this.mensajeError.set(
            fallo.message ||
              "No fue posible consultar la oferta seleccionada. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  /**
   * RN-29: si la vista queda abierta antes del cierre, al llegar la fecha se
   * habilita la validación sin obligar a recargar.
   */
  private vigilarCierre(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    this.vigiaCierre = interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.permisos.puedeVerOfertas(solicitud)) {
          this.vigiaCierre?.unsubscribe();
          this.cargar();
        }
      });
  }

  private esMismoUsuario(solicitud: SolicitudDetalle): boolean {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mockValidacion") === "mismo-usuario") {
      return true;
    }
    const usuario = solicitud.decision?.envio.usuario ?? "";
    return !!usuario && this.solicitudes.esUsuarioOrdenadorSesion(usuario);
  }

  /* ── Acciones ──────────────────────────────────────────────────────────── */

  confirmar(): void {
    this.ficha?.confirmar();
  }

  alValidar(actualizada: SolicitudDetalle): void {
    this.solicitud.set(actualizada);
    this.vista.set("decidida");
    this.anuncio.set(
      "La validación quedó registrada y el expediente pasó a solo lectura.",
    );
  }

  reintentar(): void {
    this.cargar();
  }

  /* ── Navegación ────────────────────────────────────────────────────────── */

  volver(): void {
    void this.router.navigate(["/cotizaciones", "bandeja-validacion"]);
  }

  verResultado(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate([
        "/cotizaciones",
        "validacion",
        solicitud.id,
        "resultado",
      ]);
    }
  }

  verExpediente(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate(["/cotizaciones", "solicitudes", solicitud.id]);
    }
  }

  abrirComparador(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate([
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "evaluacion",
      ]);
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

  abrirDetalle(vista: VistaDetalleOferta): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    const proveedorId =
      this.decision()?.proveedorId ??
      this.detalle()?.oferente.proveedor.id ??
      "";
    if (!proveedorId) {
      return;
    }
    const datos: DialogoDetalleOfertaDatos = {
      solicitud,
      proveedorId,
      vista,
    };
    this.dialogo.open<
      DialogoDetalleOfertaValidacionComponent,
      DialogoDetalleOfertaDatos,
      void
    >(DialogoDetalleOfertaValidacionComponent, {
      data: datos,
      width: vista === "cotizacion" ? "56rem" : "42rem",
      maxWidth: "96vw",
      maxHeight: "90vh",
      autoFocus: ".dialogo__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-detalle-titulo",
    });
  }

  /** Provisional: no hay generador de expedientes en el cliente. */
  descargarExpediente(): void {
    void this.alerta.showAlert(
      "Descargar expediente (ZIP)",
      "El expediente completo se generará cuando el gestor documental institucional esté conectado. Esta descarga es simulada.",
    );
  }

  /* ── Presentación ──────────────────────────────────────────────────────── */

  get etiquetaTipo(): string {
    const solicitud = this.solicitud();
    return solicitud ? etiquetaTipoCotizacion(solicitud.tipoCotizacion) : "";
  }

  etiquetaUnidad(valor: string): string {
    return etiquetaUnidadEjecutora(valor);
  }

  responsable(solicitud: SolicitudDetalle): string {
    const responsable = solicitud.general.responsable;
    return `${responsable.nombres} ${responsable.apellidos}`.trim();
  }

  presupuesto(solicitud: SolicitudDetalle): string {
    const valor = solicitud.presupuesto?.valorCdp ?? 0;
    return valor > 0 ? `${this.moneda(valor)} COP` : "Por definir";
  }

  numeroCdp(solicitud: SolicitudDetalle): string {
    return solicitud.presupuesto?.saldo.numeroCdp ?? "Por definir";
  }

  porcentajeAhorro(valor: number): string {
    return new Intl.NumberFormat("es-CO", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(valor);
  }
}
