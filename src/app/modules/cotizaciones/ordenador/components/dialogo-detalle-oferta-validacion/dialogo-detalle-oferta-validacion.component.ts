import { Component, Inject, OnInit, computed, inject, signal } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Router } from "@angular/router";
import { AlertService } from "src/app/shared/services/alert.service";
import type { DecisionSolicitud } from "../../../models/decision.model";
import {
  decisionDeProveedor,
  justificacionFinalDecision,
} from "../../../models/decision.model";
import { etiquetaEstadoDocumentoOferta } from "../../../models/documentos.model";
import type {
  DetalleProveedorOferta,
  DocumentoOfertaRadicado,
  FilaItemOferta,
} from "../../../models/detalle-proveedor-oferta.model";
import { filasItemsOferta } from "../../../models/detalle-proveedor-oferta.model";
import { formatoCop } from "../../../models/necesidad.model";
import {
  identidadProveedor,
  sitioWebProveedor,
} from "../../../models/proveedores.model";
import type { SolicitudDetalle } from "../../../models/solicitud.model";
import { OferentesService } from "../../../services/oferentes.service";

/** Sección que muestra el modal de detalle del oferente. */
export type VistaDetalleOferta = "persona" | "respuesta" | "cotizacion";

/** Datos que recibe el modal desde el resultado de la validación (O-02). */
export interface DialogoDetalleOfertaDatos {
  readonly solicitud: SolicitudDetalle;
  readonly proveedorId: string;
  readonly vista: VistaDetalleOferta;
}

type EstadoModal = "cargando" | "listo" | "error";

const TITULOS: Readonly<Record<VistaDetalleOferta, string>> = {
  persona: "Detalle de la persona / oferente",
  respuesta: "Respuesta del solicitante",
  cotizacion: "Cotización recibida",
};

const ICONOS: Readonly<Record<VistaDetalleOferta, string>> = {
  persona: "badge",
  respuesta: "fact_check",
  cotizacion: "request_quote",
};

/**
 * Detalle de un oferente dentro del resultado de la validación (O-02).
 *
 * Reemplaza los drawers del mockup por un modal con tres vistas. No replica el
 * detalle completo de S-10: reutiliza su misma proyección
 * (`OferentesService.obtenerDetalleProveedor`) y sus mismas utilidades de
 * cálculo (`filasItemsOferta`), y ofrece el enlace a la pantalla completa.
 *
 * Es de solo lectura: no selecciona, no decide y no cambia la oferta.
 */
@Component({
  selector: "app-dialogo-detalle-oferta-validacion",
  templateUrl: "./dialogo-detalle-oferta-validacion.component.html",
  styleUrls: ["./dialogo-detalle-oferta-validacion.component.scss"],
  standalone: false,
})
export class DialogoDetalleOfertaValidacionComponent implements OnInit {
  private readonly servicio = inject(OferentesService);
  private readonly router = inject(Router);
  private readonly alerta = inject(AlertService);

  readonly moneda = formatoCop;

  readonly estado = signal<EstadoModal>("cargando");
  readonly detalle = signal<DetalleProveedorOferta | null>(null);
  readonly error = signal("");

  readonly titulo = TITULOS[this.datos.vista];
  readonly icono = ICONOS[this.datos.vista];

  readonly identidad = computed(() => {
    const detalle = this.detalle();
    if (!detalle) {
      return null;
    }
    return (
      detalle.oferta?.identidad ?? identidadProveedor(detalle.oferente.proveedor)
    );
  });

  readonly documento = computed(
    () => this.detalle()?.oferente.proveedor.nit ?? "",
  );

  readonly sitioWeb = computed(() => {
    const detalle = this.detalle();
    return detalle ? sitioWebProveedor(detalle.oferente.proveedor) : "";
  });

  readonly oferta = computed(() => this.detalle()?.oferta ?? null);

  readonly tipoPersona = computed(
    () => this.identidad()?.etiquetaTipoPersona ?? "",
  );

  readonly representante = computed(
    () => this.identidad()?.representante ?? "",
  );

  readonly correo = computed(() => this.identidad()?.correo ?? "");

  readonly direccion = computed(
    () => this.identidad()?.direccionFiscal ?? "",
  );

  readonly ubicacion = computed(() => this.identidad()?.ubicacion ?? "");

  readonly filas = computed<readonly FilaItemOferta[]>(() => {
    const oferta = this.oferta();
    return oferta
      ? filasItemsOferta(this.datos.solicitud, oferta)
      : [];
  });

  readonly documentos = computed<readonly DocumentoOfertaRadicado[]>(
    () => this.detalle()?.documentos ?? [],
  );

  readonly decision = computed<DecisionSolicitud | null>(() =>
    decisionDeProveedor(this.datos.solicitud, this.datos.proveedorId),
  );

  readonly justificacion = computed(() => {
    const decision = this.decision();
    return decision ? justificacionFinalDecision(decision) : "";
  });

  constructor(
    private readonly dialogRef: MatDialogRef<
      DialogoDetalleOfertaValidacionComponent,
      void
    >,
    @Inject(MAT_DIALOG_DATA) readonly datos: DialogoDetalleOfertaDatos,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.estado.set("cargando");
    this.error.set("");

    this.servicio
      .obtenerDetalleProveedor(this.datos.solicitud, this.datos.proveedorId)
      .subscribe({
        next: (detalle) => {
          if (!detalle) {
            this.error.set(
              "El proveedor ya no forma parte de las ofertas de esta solicitud.",
            );
            this.estado.set("error");
            return;
          }
          this.detalle.set(detalle);
          this.estado.set("listo");
        },
        error: (fallo: Error) => {
          this.error.set(
            fallo.message ||
              "No fue posible consultar el detalle del proveedor. Intente nuevamente.",
          );
          this.estado.set("error");
        },
      });
  }

  etiquetaEstadoDocumento(documento: DocumentoOfertaRadicado): string {
    return etiquetaEstadoDocumentoOferta(documento.estado);
  }

  /** Descarga simulada: el gestor documental no está conectado. */
  abrirDocumento(documento: DocumentoOfertaRadicado): void {
    this.servicio
      .obtenerDocumentoOferta(
        this.datos.solicitud,
        this.datos.proveedorId,
        documento.id,
        "descargar",
      )
      .subscribe({
        next: (resuelto) =>
          void this.alerta.showAlert(documento.nombre, resuelto.mensaje),
        error: (fallo: Error) => void this.alerta.showAlert("Documento", fallo.message),
      });
  }

  /** Abre S-10 con la pestaña equivalente, para volver luego a este expediente. */
  verDetalleCompleto(): void {
    const solicitud = this.datos.solicitud;
    this.dialogRef.close();
    void this.router.navigate(
      [
        "/cotizaciones",
        "solicitudes",
        solicitud.id,
        "evaluacion",
        "proveedores",
        this.datos.proveedorId,
      ],
      {
        queryParams: {
          tab: this.datos.vista,
          volver: "validacion",
        },
      },
    );
  }

  cerrar(): void {
    this.dialogRef.close();
  }
}
