import { Component, DestroyRef, OnInit, computed, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import {
  ACCIONES_VALIDACION,
  AccionValidacion,
} from "src/app/core/constants/estados-solicitud.const";
import { ACCIONES_VALIDACION_POR_ROL_Y_ESTADO } from "src/app/core/constants/acciones-por-rol-y-estado.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { RolService } from "src/app/core/services/rol.service";
import {
  CampoFiltro,
  FiltroRapido,
} from "src/app/shared/components/listado-filtros/listado-filtros.component";
import { AlertService } from "src/app/shared/services/alert.service";
import { etiquetaTipoCotizacionProveedor } from "../../../models/invitacion-proveedor.model";
import { formatoCop } from "../../../models/necesidad.model";
import {
  UNIDADES_EJECUTORAS,
  VIGENCIAS,
  etiquetaUnidadEjecutora,
} from "../../../models/solicitud.model";
import {
  GRUPOS_FILTRO_VALIDACION,
  GrupoFiltroValidacion,
  TIPOS_COTIZACION_VALIDACION,
  conteosValidacionesVacios,
  estadoValidacion,
} from "../../../models/validacion-ordenador.model";
import type {
  ConteosValidaciones,
  FiltroValidacionesOrdenador,
  ResultadoListadoValidaciones,
  SolicitudValidacionOrdenador,
} from "../../../models/validacion-ordenador.model";
import { SolicitudesService } from "../../../services/solicitudes.service";

type EstadoVista = "cargando" | "listo" | "error";

/** La semilla del módulo es 2026 (igual que S-01); el filtro arranca ahí. */
const VIGENCIA_ACTUAL = VIGENCIAS[0]?.valor ?? String(new Date().getFullYear());

const CRITERIOS_INICIALES: FiltroValidacionesOrdenador = {
  vigencia: VIGENCIA_ACTUAL,
  estadoValidacion: "por-validar",
  unidadEjecutora: "",
  tipoCotizacion: "",
  dependencia: "",
  busqueda: "",
  desde: "",
  hasta: "",
  ordenNumero: "desc",
};

const OPCIONES_UNIDADES: readonly { valor: string; etiqueta: string }[] = [
  { valor: "", etiqueta: "Todas las unidades" },
  ...UNIDADES_EJECUTORAS.map((unidad) => ({
    valor: unidad.valor,
    etiqueta: unidad.etiqueta,
  })),
];

function crearCamposFiltro(
  dependencias: readonly string[],
): readonly CampoFiltro[] {
  return [
    {
      clave: "busqueda",
      etiqueta: "Búsqueda rápida",
      tipo: "texto",
      placeholder: "Número, título o proveedor...",
    },
    {
      clave: "vigencia",
      etiqueta: "Vigencia",
      tipo: "select",
      requerido: true,
      opciones: VIGENCIAS,
    },
    {
      clave: "unidadEjecutora",
      etiqueta: "Unidad ejecutora",
      tipo: "select",
      opciones: OPCIONES_UNIDADES,
    },
    {
      clave: "tipoCotizacion",
      etiqueta: "Tipo de cotización",
      tipo: "select",
      opciones: TIPOS_COTIZACION_VALIDACION,
    },
    {
      clave: "dependencia",
      etiqueta: "Dependencia solicitante",
      tipo: "select",
      opciones: [
        { valor: "", etiqueta: "Todas las dependencias" },
        ...dependencias.map((dependencia) => ({
          valor: dependencia,
          etiqueta: dependencia,
        })),
      ],
    },
    {
      clave: "desde",
      etiqueta: "Procesamiento desde",
      tipo: "fecha",
    },
    {
      clave: "hasta",
      etiqueta: "Procesamiento hasta",
      tipo: "fecha",
    },
  ];
}

/**
 * Bandeja de validación del Ordenador del Gasto (O-01).
 *
 * Lista las solicitudes cerradas con proveedor seleccionado y decisión
 * registrada, asignadas al ordenador de la sesión (RN-02) y con el periodo de
 * cotización terminado (RN-29). No decide: la acción principal navega a O-03.
 *
 * La tabla, el paginador y los estados de vista siguen el patrón de P-01/S-01;
 * los indicadores y los filtros de fecha son propios de esta pantalla.
 */
@Component({
  selector: "app-bandeja-validacion",
  templateUrl: "./bandeja-validacion.component.html",
  styleUrls: ["./bandeja-validacion.component.scss"],
  standalone: false,
})
export class BandejaValidacionComponent implements OnInit {
  constructor(
    private readonly servicio: SolicitudesService,
    readonly permisos: PermisosSolicitudService,
    private readonly rol: RolService,
    private readonly router: Router,
    private readonly alerta: AlertService,
    private readonly destroyRef: DestroyRef,
  ) {}

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Bandeja de Validación</b></p>";
  readonly ACCIONES = ACCIONES_VALIDACION;

  /**
   * La columna de acciones solo se pinta si algún rol del usuario tiene algo
   * que ofrecer en la matriz de validación (hoy solo OG).
   */
  readonly hayColumnaAcciones = computed(() =>
    this.rol.mostrarAcciones(ACCIONES_VALIDACION_POR_ROL_Y_ESTADO),
  );

  readonly grupos = GRUPOS_FILTRO_VALIDACION;
  readonly opcionesPorPagina: readonly number[] = [10, 25, 50];
  readonly esqueleto: readonly number[] = [1, 2, 3, 4, 5];

  camposFiltro: readonly CampoFiltro[] = crearCamposFiltro([]);

  vista = signal<EstadoVista>("cargando");
  validaciones: readonly SolicitudValidacionOrdenador[] = [];
  total = 0;
  conteos: ConteosValidaciones = conteosValidacionesVacios();
  dependencias: readonly string[] = [];
  pagina = 0;
  porPagina = 10;
  filtroRapidoActivo: GrupoFiltroValidacion = "por-validar";
  filaMenuAbierto: string | null = null;
  criterios: FiltroValidacionesOrdenador = { ...CRITERIOS_INICIALES };
  mensajeError = "";
  resultadoAnunciable = "";
  private cargaActual?: Subscription;
  private dependenciasCargadas = false;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargaActual?.unsubscribe();
    this.vista.set("cargando");
    this.mensajeError = "";

    this.cargaActual = this.servicio
      .listarValidacionesOrdenador(this.criterios, this.pagina, this.porPagina)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado: ResultadoListadoValidaciones) => {
          this.validaciones = resultado.validaciones;
          this.total = resultado.total;
          this.conteos = resultado.conteos;
          this.dependencias = resultado.dependencias;
          if (!this.dependenciasCargadas) {
            this.camposFiltro = crearCamposFiltro(resultado.dependencias);
            this.dependenciasCargadas = true;
          }
          this.vista.set("listo");
          this.resultadoAnunciable = `${resultado.total} ${
            resultado.total === 1 ? "solicitud" : "solicitudes"
          } para validación.`;
        },
        error: (error: Error) => {
          this.mensajeError = error.message;
          this.vista.set("error");
          this.resultadoAnunciable = "";
        },
      });
  }

  get filtrosRapidos(): readonly FiltroRapido[] {
    return this.grupos.map((grupo) => ({
      ...grupo,
      conteo: this.conteos[grupo.valor],
    }));
  }

  get notaFiltros(): string {
    const activo =
      this.grupos.find((grupo) => grupo.valor === this.filtroRapidoActivo)
        ?.etiqueta ?? "Todas";
    return `Criterio activo: ${activo}. Solo se listan solicitudes con el periodo de cotización cerrado (RN-29) asignadas a su despacho (RN-02). El orden y el criterio mensual son provisionales.`;
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  get rangoInicio(): number {
    return this.total === 0 ? 0 : this.pagina * this.porPagina + 1;
  }

  get rangoFin(): number {
    return Math.min(this.total, (this.pagina + 1) * this.porPagina);
  }

  get paginasVisibles(): readonly number[] {
    const total = this.totalPaginas;
    let inicio = Math.max(1, this.pagina + 1 - 2);
    const fin = Math.min(total, inicio + 4);
    inicio = Math.max(1, fin - 4);
    const paginas: number[] = [];
    for (let numero = inicio; numero <= fin; numero += 1) {
      paginas.push(numero);
    }
    return paginas;
  }

  get hayFiltrosAplicados(): boolean {
    return (
      this.criterios.vigencia !== CRITERIOS_INICIALES.vigencia ||
      this.criterios.estadoValidacion !== CRITERIOS_INICIALES.estadoValidacion ||
      this.criterios.unidadEjecutora !== "" ||
      this.criterios.tipoCotizacion !== "" ||
      this.criterios.dependencia !== "" ||
      this.criterios.busqueda.trim() !== "" ||
      this.criterios.desde !== "" ||
      this.criterios.hasta !== ""
    );
  }

  filtrar(valores: Record<string, string>): void {
    this.criterios = {
      ...this.criterios,
      vigencia: valores["vigencia"] ?? CRITERIOS_INICIALES.vigencia,
      unidadEjecutora: valores["unidadEjecutora"] ?? "",
      tipoCotizacion: valores["tipoCotizacion"] ?? "",
      dependencia: valores["dependencia"] ?? "",
      busqueda: valores["busqueda"] ?? "",
      desde: valores["desde"] ?? "",
      hasta: valores["hasta"] ?? "",
    };
    this.pagina = 0;
    this.cargar();
  }

  filtrarRapido(valor: string): void {
    const grupo = this.grupos.find((opcion) => opcion.valor === valor);
    if (!grupo) {
      return;
    }
    this.filtroRapidoActivo = grupo.valor;
    this.criterios = {
      ...this.criterios,
      estadoValidacion: grupo.valor === "todas" ? "" : grupo.valor,
    };
    this.pagina = 0;
    this.cargar();
  }

  limpiar(): void {
    this.criterios = { ...CRITERIOS_INICIALES };
    this.filtroRapidoActivo = "por-validar";
    this.pagina = 0;
    this.cargar();
  }

  ordenarPorNumero(): void {
    const ordenNumero = this.criterios.ordenNumero === "desc" ? "asc" : "desc";
    this.criterios = { ...this.criterios, ordenNumero };
    this.pagina = 0;
    this.cargar();
  }

  cambiarPorPagina(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (!this.opcionesPorPagina.includes(valor) || valor === this.porPagina) {
      return;
    }
    this.porPagina = valor;
    this.pagina = 0;
    this.cargar();
  }

  irAPagina(indice: number): void {
    const destino = Math.min(Math.max(0, indice), this.totalPaginas - 1);
    if (destino === this.pagina) {
      return;
    }
    this.pagina = destino;
    this.cargar();
  }

  accionesDe(
    fila: SolicitudValidacionOrdenador,
  ): readonly AccionValidacion[] {
    return this.permisos.accionesValidacionPermitidas(fila);
  }

  abrirMenuAcciones(id: string): void {
    this.filaMenuAbierto = id;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  etiquetaAccion(accion: AccionValidacion): string {
    return this.permisos.etiquetaAccionValidacion(accion);
  }

  ejecutarAccion(
    accion: AccionValidacion,
    fila: SolicitudValidacionOrdenador,
  ): void {
    const comandos = this.permisos.rutaAccionValidacion(accion, fila);
    if (!comandos) {
      void this.alerta.showAlert(
        this.etiquetaAccion(accion),
        "Esta pantalla aún no está implementada. Corresponde a una fase posterior del módulo.",
      );
      return;
    }
    void this.router.navigate(comandos);
  }

  abrirModificaciones(): void {
    void this.router.navigate([
      "cotizaciones",
      "validacion",
      "modificaciones-pendientes",
    ]);
  }

  /** Desde el vacío: muestra las validadas y rechazadas del histórico. */
  verHistoricos(): void {
    this.filtrarRapido("todas");
  }

  estadoDe(fila: SolicitudValidacionOrdenador) {
    return estadoValidacion(fila);
  }

  unidad(fila: SolicitudValidacionOrdenador): string {
    return etiquetaUnidadEjecutora(fila.solicitud.unidadEjecutora);
  }

  tipo(fila: SolicitudValidacionOrdenador): string {
    return etiquetaTipoCotizacionProveedor(fila.solicitud.tipoCotizacion);
  }

  fechaProcesamiento(fila: SolicitudValidacionOrdenador): string {
    return fila.decision.envio.fecha;
  }

  valor(fila: SolicitudValidacionOrdenador): string {
    return fila.decision.valor > 0
      ? `${formatoCop(fila.decision.valor)} COP`
      : "Por definir";
  }
}
