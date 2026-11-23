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
import { Subscription, interval } from "rxjs";
import {
  ROL_JEFE_DEPENDENCIA,
  ROL_ORDENADOR_DEL_GASTO,
} from "src/app/core/constants/roles.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { RolService } from "src/app/core/services/rol.service";
import type { PasoLineaEstados } from "src/app/shared/components/linea-estados/linea-estados.component";
import { ResultadoResolverSolicitud } from "../../../resolvers/solicitud.resolver";
import {
  faseDecisionSolicitud,
  justificacionFinalDecision,
  type DecisionSolicitud,
} from "../../../models/decision.model";
import type {
  DetalleProveedorOferta,
  DocumentoOfertaRadicado,
} from "../../../models/detalle-proveedor-oferta.model";
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
import { FichaDecisionComponent } from "../../../components/decision/ficha-decision/ficha-decision.component";
import { EvaluacionService } from "../../../services/evaluacion.service";
import { OferentesService } from "../../../services/oferentes.service";

type EstadoVista =
  | "cargando"
  | "listo"
  | "enviada"
  | "decidida"
  | "sin-oferta"
  | "bloqueado"
  | "sin-permiso"
  | "no-disponible"
  | "error"
  | "no-encontrado";

type OrigenDecision = "comparador" | "oferentes";

/** Estados en los que se puede enviar la decisión a validación. */
const ESTADOS_CON_ENVIO = [
  "enviada-proveedores",
  "enviada-con-modificaciones",
  "en-evaluacion",
  "desierta",
] as const;

/**
 * Decisión y justificación (S-11).
 *
 * Registra el envío a validación de la oferta seleccionada desde S-07.
 * Lo pueden hacer el Jefe de Dependencia y el Ordenador del Gasto. La
 * aprobación o rechazo final corresponde a las vistas exclusivas del OG
 * (O-01 a O-04), que se implementarán en una entrega posterior; por eso aquí no
 * hay selector de aprobar/rechazar.
 *
 * La vista es de una sola etapa de envío y luego de solo lectura. Aplica RN-29
 * (cierre), RN-24 (mínimo 20), RN-35 (envío único), RN-33 (resaltado) y RN-40
 * (techo presupuestal).
 */
@Component({
  selector: "app-decision-cotizacion",
  templateUrl: "./decision-cotizacion.component.html",
  styleUrls: ["./decision-cotizacion.component.scss"],
  standalone: false,
  host: { class: "formulario-material" },
})
export class DecisionCotizacionComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly evaluacion = inject(EvaluacionService);
  private readonly oferentes = inject(OferentesService);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly rol = inject(RolService);
  private readonly destroyRef = inject(DestroyRef);

  /** Formulario compartido: conserva la justificación y la confirmación. */
  @ViewChild(FichaDecisionComponent)
  ficha?: FichaDecisionComponent;

  readonly moneda = formatoCop;

  readonly vista = signal<EstadoVista>("cargando");
  readonly mensajeError = signal("");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly oferta = signal<DetalleProveedorOferta | null>(null);
  readonly decision = signal<DecisionSolicitud | null>(null);
  readonly anuncio = signal("");

  breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Decisión y justificación</b></p>";

  private origen: OrigenDecision = "comparador";
  /** Proveedor que se enviará a validación (viene de S-07/S-09/S-10). */
  private proveedorId = "";
  private vigiaCierre?: Subscription;

  readonly identidad = computed<IdentidadProveedor | null>(() => {
    const detalle = this.oferta();
    if (!detalle) {
      return null;
    }
    return detalle.oferta?.identidad ?? identidadProveedor(detalle.oferente.proveedor);
  });

  readonly ofertaComparada = computed(() => this.oferta()?.oferta ?? null);

  readonly documentos = computed<readonly DocumentoOfertaRadicado[]>(
    () => this.oferta()?.documentos ?? [],
  );

  readonly documentoPrincipal = computed<DocumentoOfertaRadicado | null>(
    () => this.documentos().find((documento) => documento.principal) ?? null,
  );

  readonly resumenDocumentos = computed(() => {
    const documentos = this.documentos();
    return {
      total: documentos.length,
      cargados: documentos.filter(
        (documento) =>
          documento.estado === "cargado" || documento.estado === "subsanado",
      ).length,
    };
  });

  readonly resultado = computed<"aprobada" | "rechazada" | null>(() => {
    const decision = this.decision();
    if (decision?.fase === "aprobada") {
      return "aprobada";
    }
    if (decision?.fase === "rechazada") {
      return "rechazada";
    }
    const estado = this.solicitud()?.estado;
    if (estado === "adjudicada") {
      return "aprobada";
    }
    if (estado === "desierta") {
      return "rechazada";
    }
    return null;
  });

  readonly justificacionFinal = computed(() => {
    const decision = this.decision();
    return decision ? justificacionFinalDecision(decision) : "";
  });

  readonly notificaciones = computed(
    () => this.decision()?.notificaciones ?? [],
  );

  readonly rolEtiqueta = computed(() => {
    if (this.rol.tieneRol(ROL_ORDENADOR_DEL_GASTO)) {
      return "Ordenador del Gasto";
    }
    if (this.rol.tieneRol(ROL_JEFE_DEPENDENCIA)) {
      return "Jefe de Dependencia";
    }
    return "Solicitante";
  });

  readonly pasosProceso = computed<readonly PasoLineaEstados[]>(() => {
    const etiquetas = [
      "Abierta",
      "Cerrada",
      "En evaluación",
      "Decisión",
      "Validación OG",
      "Resultado",
    ];
    const solicitud = this.solicitud();
    if (!solicitud) {
      return etiquetas.map((etiqueta) => ({
        etiqueta,
        estado: "pendiente" as const,
      }));
    }

    let actual = 3;
    if (this.vista() === "enviada") {
      actual = 4;
    }
    if (this.vista() === "decidida") {
      actual = 5;
    }

    return etiquetas.map((etiqueta, indice) => ({
      etiqueta,
      estado:
        indice < actual
          ? ("completado" as const)
          : indice === actual
            ? ("actual" as const)
            : ("pendiente" as const),
    }));
  });

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "solicitud"
    ] as ResultadoResolverSolicitud;
    this.origen =
      this.ruta.snapshot.queryParamMap.get("volver") === "oferentes"
        ? "oferentes"
        : "comparador";
    this.proveedorId =
      this.ruta.snapshot.queryParamMap.get("proveedorId") ?? "";

    if (resolucion.estado !== "ok") {
      this.vista.set(
        resolucion.estado === "no-encontrada" ? "no-encontrado" : "error",
      );
      if (resolucion.estado === "error") {
        this.mensajeError.set(resolucion.mensaje);
      }
      return;
    }

    const solicitud = resolucion.solicitud;
    this.solicitud.set(solicitud);
    this.breadcrumb = `<p>Gestión Proveedor › Cotizaciones › Solicitud ${solicitud.id} › Evaluación › <b>Decisión y justificación</b></p>`;

    if (!this.permisos.puedeAccederDecision()) {
      this.vista.set("sin-permiso");
      return;
    }

    const fase = faseDecisionSolicitud(solicitud);
    if (fase === "aprobada" || fase === "rechazada" || fase === "enviada") {
      this.cargar();
      return;
    }

    if (
      !ESTADOS_CON_ENVIO.includes(
        solicitud.estado as (typeof ESTADOS_CON_ENVIO)[number],
      )
    ) {
      this.vista.set("no-disponible");
      return;
    }

    if (!this.permisos.puedeVerOfertas(solicitud)) {
      this.vista.set("bloqueado");
      this.vigilarCierre(solicitud);
      return;
    }

    if (!this.permisos.puedeEnviarAValidacion(solicitud, this.proveedorId)) {
      this.vista.set("no-disponible");
      return;
    }

    this.cargar();
  }

  /* ── Carga ─────────────────────────────────────────────────────────────── */

  cargar(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      this.vista.set("no-encontrado");
      return;
    }

    this.vista.set("cargando");
    this.mensajeError.set("");
    this.evaluacion
      .obtenerDecision(solicitud)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (decision) => {
          this.decision.set(decision);
          this.cargarOferta(solicitud, decision);
        },
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar la decisión. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  private cargarOferta(
    solicitud: SolicitudDetalle,
    decision: DecisionSolicitud | null,
  ): void {
    const carga = this.proveedorId
      ? this.oferentes.obtenerDetalleProveedor(solicitud, this.proveedorId)
      : this.oferentes.obtenerOfertaSeleccionada(solicitud);

    carga
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          this.oferta.set(detalle);

          const fase =
            decision?.fase ??
            (solicitud.estado === "adjudicada"
              ? "aprobada"
              : solicitud.estado === "desierta"
                ? "rechazada"
                : null);

          // Un rechazo habilita reenviar a otro proveedor; el rechazado solo se
          // consulta en modo lectura.
          const reenvio =
            fase === "rechazada" &&
            !!this.proveedorId &&
            decision?.proveedorId !== this.proveedorId;

          if (fase === "aprobada") {
            this.vista.set("decidida");
            this.anuncio.set("Decisión registrada en el expediente.");
            return;
          }
          if (fase === "enviada") {
            this.vista.set("enviada");
            this.anuncio.set(
              "Decisión enviada a validación del Ordenador del Gasto.",
            );
            return;
          }
          if (fase === "rechazada" && !reenvio) {
            this.vista.set("decidida");
            this.anuncio.set("Decisión registrada en el expediente.");
            return;
          }
          if (!detalle) {
            this.vista.set("sin-oferta");
            return;
          }
          if (
            !this.permisos.puedeEnviarAValidacion(
              solicitud,
              this.proveedorId,
            )
          ) {
            this.vista.set("no-disponible");
            return;
          }
          this.vista.set("listo");
        },
        error: (error: Error) => {
          this.mensajeError.set(
            error.message ||
              "No fue posible consultar la oferta seleccionada. Intente nuevamente.",
          );
          this.vista.set("error");
        },
      });
  }

  /**
   * RN-29: si la vista queda abierta antes del cierre, al llegar la fecha se
   * habilita el envío sin obligar a recargar.
   */
  private vigilarCierre(solicitud: SolicitudDetalle): void {
    this.vigiaCierre = interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.permisos.puedeVerOfertas(solicitud)) {
          this.vigiaCierre?.unsubscribe();
          this.solicitud.set({ ...solicitud });
          this.cargar();
        }
      });
  }

  /* ── Envío a validación ────────────────────────────────────────────────── */

  /**
   * Guardas externas del envío: permisos, estado y presupuesto.
   *
   * La validez del formulario y el envío los gestiona `FichaDecisionComponent`.
   */
  get puedeEnviarExterno(): boolean {
    const solicitud = this.solicitud();
    return (
      !!solicitud &&
      this.vista() === "listo" &&
      !this.ofertaComparada()?.excedePresupuesto &&
      this.permisos.puedeEnviarAValidacion(solicitud, this.proveedorId)
    );
  }

  get puedeConfirmar(): boolean {
    return this.ficha?.puedeGuardar ?? false;
  }

  alEnviar(actualizada: SolicitudDetalle): void {
    this.solicitud.set(actualizada);
    this.decision.set(actualizada.decision ?? null);
    this.vista.set("enviada");
    this.anuncio.set("Decisión enviada a validación del Ordenador del Gasto.");
  }

  confirmarEnvio(): void {
    this.ficha?.confirmar();
  }

  get etiquetaDocumento(): string {
    return this.identidad()?.tipoPersona === "natural" ? "Documento" : "NIT";
  }

  get fechaLimite(): string {
    const cierre = this.solicitud()?.cierre;
    return cierre ? `${cierre} 23:59:59 COT` : "Sin fecha de cierre";
  }

  get etiquetaVolver(): string {
    return this.origen === "oferentes"
      ? "Volver al tablero de oferentes"
      : "Volver al comparador (S-09)";
  }

  /* ── Navegación ────────────────────────────────────────────────────────── */

  volver(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      this.volverAlListado();
      return;
    }
    const destino =
      this.origen === "oferentes"
        ? ["/cotizaciones", "solicitudes", solicitud.id, "oferentes"]
        : ["/cotizaciones", "solicitudes", solicitud.id, "evaluacion"];
    void this.router.navigate(destino);
  }

  volverAlListado(): void {
    void this.router.navigate(["/cotizaciones", "solicitudes"]);
  }

  irAlComparador(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      this.volverAlListado();
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "solicitudes",
      solicitud.id,
      "evaluacion",
    ]);
  }

  verHistorial(): void {
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

  verSolicitud(): void {
    const solicitud = this.solicitud();
    if (solicitud) {
      void this.router.navigate(["/cotizaciones", "solicitudes", solicitud.id]);
    }
  }

  verOferta(): void {
    const solicitud = this.solicitud();
    const proveedorId =
      this.proveedorId ||
      this.decision()?.proveedorId ||
      this.oferta()?.oferente.proveedor.id;
    if (!solicitud || !proveedorId) {
      return;
    }
    void this.router.navigate(
      [
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "evaluacion",
        "proveedores",
        proveedorId,
      ],
      { queryParams: { volver: this.origen, tab: "cotizacion" } },
    );
  }

  reintentarCarga(): void {
    if (this.solicitud()) {
      this.cargar();
      return;
    }
    this.reintentarResolucion();
  }

  reintentarResolucion(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { reintento: Date.now() },
      queryParamsHandling: "merge",
    });
  }

  /* ── Utilidades de presentación ────────────────────────────────────────── */

  etiquetaEstadoDocumento(documento: DocumentoOfertaRadicado): string {
    switch (documento.estado) {
      case "cargado":
        return "Cargado";
      case "subsanado":
        return "Subsanado";
      case "pendiente":
        return "Pendiente";
      case "no-subsanado":
        return "No subsanado";
    }
  }

  etiquetaTipo(tipo: SolicitudDetalle["tipoCotizacion"]): string {
    return etiquetaTipoCotizacion(tipo);
  }

  etiquetaUnidad(valor: string): string {
    return etiquetaUnidadEjecutora(valor);
  }

  /** Vuelve al listado de solicitudes de cotización. */
  volverListaSolicitudes(): void {
    void this.router.navigate(["/cotizaciones", "solicitudes"]);
  }
}
