import { Component, OnInit, computed, inject, signal } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { ActivatedRoute, Router } from "@angular/router";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { RolService } from "src/app/core/services/rol.service";
import type { EventoLineaTiempo } from "src/app/shared/components/linea-tiempo/linea-tiempo.component";
import { AlertService } from "src/app/shared/services/alert.service";
import type { DecisionSolicitud } from "../../../models/decision.model";
import {
  justificacionFinalDecision,
  resultadoDecisionSolicitud,
} from "../../../models/decision.model";
import type {
  OfertaComparada,
  ResultadoComparativo,
} from "../../../models/comparativo.model";
import type { EventoHistorial } from "../../../models/historial.model";
import { eventoLineaTiempoHistorial } from "../../../models/historial.model";
import { formatoCop } from "../../../models/necesidad.model";
import {
  estadoVistaResultadoValidacion,
  filasOfertasValidacion,
  pasosProcesoValidacion,
  resumenOfertasValidacion,
  type EstadoResultadoValidacion,
  type FilaOfertaValidacion,
} from "../../../models/resultado-validacion-ordenador.model";
import {
  etiquetaTipoCotizacion,
  type SolicitudDetalle,
} from "../../../models/solicitud.model";
import type { EstadoValidacionOrdenador } from "src/app/core/constants/estados-solicitud.const";
import { estadoValidacion } from "../../../models/validacion-ordenador.model";
import type { SolicitudValidacionOrdenador } from "../../../models/validacion-ordenador.model";
import type { ResolucionResultadoValidacion } from "../../resolvers/resultado-validacion.resolver";
import {
  DialogoDetalleOfertaValidacionComponent,
  type DialogoDetalleOfertaDatos,
  type VistaDetalleOferta,
} from "../../components/dialogo-detalle-oferta-validacion/dialogo-detalle-oferta-validacion.component";

/** Anchos del modal de detalle según su contenido. */
const ANCHOS_MODAL: Readonly<Record<VistaDetalleOferta, string>> = {
  persona: "42rem",
  respuesta: "42rem",
  cotizacion: "56rem",
};

/**
 * Resultado de la solicitud para el Ordenador del Gasto (O-02).
 *
 * Es la pantalla de revisión previa a la validación. Muestra el expediente, las
 * cotizaciones recibidas con el proveedor elegido resaltado (RN-33), la
 * justificación del solicitante y, si ya existe, el resultado de la validación
 * en modo lectura (RN-35).
 *
 * No decide: la aprobación o el rechazo se registran en O-03 (RN-34). El
 * comparativo y los totales salen de `OferentesService` (la misma utilidad de
 * S-09), la oferta completa se consulta en S-10 y los eventos se pintan con la
 * línea de tiempo del historial.
 *
 * Provisional: notificaciones reales (RF-13), alerta SICAPITAL/ÁGORA (RN-10),
 * visibilidad de la justificación y descarga del expediente.
 */
@Component({
  selector: "app-resultado-validacion",
  templateUrl: "./resultado-validacion.component.html",
  styleUrls: ["./resultado-validacion.component.scss"],
  standalone: false,
})
export class ResultadoValidacionComponent implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permisos = inject(PermisosSolicitudService);
  private readonly rol = inject(RolService);
  private readonly dialogo = inject(MatDialog);
  private readonly alerta = inject(AlertService);

  readonly moneda = formatoCop;

  readonly vista = signal<EstadoResultadoValidacion>("cargando");
  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly comparativo = signal<ResultadoComparativo | null>(null);
  readonly mensajeError = signal("");
  readonly anuncio = signal("");
  filaMenuAbierto: string | null = null;

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Resultado de la solicitud</b></p>";

  readonly decision = computed<DecisionSolicitud | null>(
    () => this.solicitud()?.decision ?? null,
  );

  readonly resultado = computed(() => {
    const solicitud = this.solicitud();
    return solicitud ? resultadoDecisionSolicitud(solicitud) : null;
  });

  readonly validacion = computed(() => this.decision()?.validacion ?? null);

  readonly justificacionFinal = computed(() => {
    const decision = this.decision();
    return decision ? justificacionFinalDecision(decision) : "";
  });

  readonly notificaciones = computed(
    () => this.decision()?.notificaciones ?? [],
  );

  readonly ofertas = computed<readonly FilaOfertaValidacion[]>(() => {
    const comparativo = this.comparativo();
    return comparativo ? filasOfertasValidacion(comparativo) : [];
  });

  readonly resumen = computed(() => {
    const comparativo = this.comparativo();
    return comparativo
      ? resumenOfertasValidacion(comparativo)
      : { total: 0, fueraDePresupuesto: 0, sinOferta: 0 };
  });

  readonly seleccionada = computed<OfertaComparada | null>(() => {
    const comparativo = this.comparativo();
    return comparativo?.ofertas.find((oferta) => oferta.seleccionado) ?? null;
  });

  /** Subtítulo de la tarjeta de ofertas: cifras reales, sin jerga. */
  readonly subtituloOfertas = computed(() => {
    if (this.vista() === "bloqueado") {
      return "Disponibles cuando termine el periodo de cotización (RN-29).";
    }
    const resumen = this.resumen();
    if (!resumen.total) {
      return "La solicitud no registra cotizaciones radicadas.";
    }
    const ofertas = `${resumen.total} ${
      resumen.total === 1 ? "oferta radicada" : "ofertas radicadas"
    }`;
    const fuera =
      resumen.fueraDePresupuesto > 0
        ? ` · ${resumen.fueraDePresupuesto} fuera del presupuesto`
        : "";
    return `${ofertas}${fuera}`;
  });

  readonly pasos = computed(() => {
    const solicitud = this.solicitud();
    return solicitud ? pasosProcesoValidacion(solicitud) : [];
  });

  readonly historial = computed<readonly EventoLineaTiempo[]>(() => {
    const eventos: readonly EventoHistorial[] =
      this.solicitud()?.historial?.eventos ?? [];
    return eventos.map((evento) => eventoLineaTiempoHistorial(evento));
  });

  /** Estado del acto de validación, cuando ya existe una decisión. */
  readonly estadoActo = computed<EstadoValidacionOrdenador | null>(() => {
    const decision = this.decision();
    return decision ? estadoValidacion({ decision }) : null;
  });

  /**
   * Fila equivalente de la bandeja, para consultar la matriz de acciones.
   *
   * Evita repetir reglas: si la matriz no ofrece `validar` (por ejemplo, una
   * validación ya decidida), la vista tampoco lo ofrece (RN-35).
   */
  readonly filaValidacion = computed<SolicitudValidacionOrdenador | null>(() => {
    const solicitud = this.solicitud();
    const decision = this.decision();
    if (!solicitud || !decision) {
      return null;
    }
    const seleccionada = this.seleccionada();
    return {
      solicitud,
      decision,
      proveedor: {
        id: decision.proveedorId,
        nombre: decision.proveedorNombre,
        nit: seleccionada?.proveedor.nit ?? null,
      },
      invitacion: null,
    };
  });

  readonly acciones = computed(() => {
    // Lectura reactiva de los roles: si llegan después del primer render, la
    // matriz se vuelve a evaluar y el CTA de validación se habilita solo.
    const roles = this.rol.roles();
    const fila = this.filaValidacion();
    if (!roles.length || !fila) {
      return [];
    }
    return this.permisos.accionesValidacionPermitidas(fila);
  });

  readonly puedeValidar = computed(() =>
    this.acciones().includes("validar"),
  );

  ngOnInit(): void {
    const resolucion = this.ruta.snapshot.data[
      "resultado"
    ] as ResolucionResultadoValidacion;

    if (resolucion.estado === "error") {
      this.mensajeError.set(resolucion.mensaje);
      this.vista.set("error");
      return;
    }

    if (resolucion.estado === "no-encontrada") {
      this.vista.set("no-encontrada");
      return;
    }

    if (resolucion.estado === "no-asignada") {
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

    this.solicitud.set(resolucion.solicitud);
    this.comparativo.set(resolucion.comparativo);
    const estado = estadoVistaResultadoValidacion(resolucion.solicitud);
    this.vista.set(estado);
    this.anuncio.set(anuncioEstado(estado, resolucion.solicitud));
  }

  /* ── Navegación ────────────────────────────────────────────────────────── */

  volver(): void {
    void this.router.navigate(["/cotizaciones", "bandeja-validacion"]);
  }

  verProceso(): void {
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

  /** O-03 sigue siendo un placeholder: la ruta existe y se navega a ella. */
  irAValidar(): void {
    const solicitud = this.solicitud();
    if (!solicitud || !this.puedeValidar()) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "validacion",
      solicitud.id,
      "validar",
    ]);
  }

  /** Resolución formal (O-03): se consulta sin volver a validar. */
  verResolucion(): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    void this.router.navigate([
      "/cotizaciones",
      "validacion",
      solicitud.id,
      "validar",
    ]);
  }

  abrirHistorialCompleto(): void {
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

  reintentar(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { reintento: Date.now() },
      queryParamsHandling: "merge",
    });
  }

  /** Provisional: no hay generador de expedientes en el cliente. */
  descargarExpediente(): void {
    void this.alerta.showAlert(
      "Descargar expediente (ZIP)",
      "El expediente completo se generará cuando el gestor documental institucional esté conectado. Esta descarga es simulada.",
    );
  }

  /* ── Menú de acciones y modales ────────────────────────────────────────── */

  abrirMenuAcciones(id: string): void {
    this.filaMenuAbierto = id;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  abrirDetalle(fila: FilaOfertaValidacion, vista: VistaDetalleOferta): void {
    const solicitud = this.solicitud();
    if (!solicitud) {
      return;
    }
    this.dialogo.open<
      DialogoDetalleOfertaValidacionComponent,
      DialogoDetalleOfertaDatos,
      void
    >(DialogoDetalleOfertaValidacionComponent, {
      data: { solicitud, proveedorId: fila.id, vista },
      width: ANCHOS_MODAL[vista],
      maxWidth: "96vw",
      maxHeight: "90vh",
      autoFocus: ".dialogo__cerrar",
      restoreFocus: true,
      ariaLabelledBy: "dialogo-detalle-titulo",
    });
  }

  /** La respuesta del solicitante solo existe para el proveedor decidido. */
  tieneRespuesta(fila: FilaOfertaValidacion): boolean {
    const solicitud = this.solicitud();
    return solicitud?.decision?.proveedorId === fila.id;
  }

  /* ── Presentación ──────────────────────────────────────────────────────── */

  etiquetaEstadoOferta(fila: FilaOfertaValidacion): string {
    return fila.seleccionado ? "Proveedor seleccionado" : "No seleccionado";
  }

  etiquetaTipo(solicitud: SolicitudDetalle): string {
    return etiquetaTipoCotizacion(solicitud.tipoCotizacion);
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
}

/** Anuncio accesible del estado. */
function anuncioEstado(
  estado: EstadoResultadoValidacion,
  solicitud: SolicitudDetalle,
): string {
  switch (estado) {
    case "sin-acceso":
      return "No tiene acceso a esta validación.";
    case "bloqueado":
      return "La validación se habilita cuando termine el periodo de cotización.";
    case "no-disponible":
      return "La solicitud no admite validación en su estado actual.";
    case "sin-decision":
      return "El solicitante aún no ha registrado su decisión.";
    case "pendiente":
      return "La decisión del solicitante está pendiente de validación.";
    case "decidida":
      return `La validación de ${solicitud.id} ya fue registrada y se muestra en modo lectura.`;
    default:
      return "";
  }
}
