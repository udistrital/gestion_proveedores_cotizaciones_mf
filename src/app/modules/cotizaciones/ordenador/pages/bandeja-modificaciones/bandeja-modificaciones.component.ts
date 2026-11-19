import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { Subscription } from "rxjs";
import {
  ACCIONES_MODIFICACION,
  AccionModificacion,
} from "src/app/core/constants/estados-solicitud.const";
import { ACCIONES_MODIFICACION_POR_ROL_Y_ESTADO } from "src/app/core/constants/acciones-por-rol-y-estado.const";
import { PermisosSolicitudService } from "src/app/core/services/permisos-solicitud.service";
import { RolService } from "src/app/core/services/rol.service";
import {
  CampoFiltro,
  FiltroRapido,
} from "src/app/shared/components/listado-filtros/listado-filtros.component";
import { AlertService } from "src/app/shared/services/alert.service";
import {
  GRUPOS_FILTRO_MODIFICACION,
  GrupoFiltroModificacion,
  TIPOS_CAMBIO_MODIFICACION,
  conteosModificacionesVacios,
} from "../../../models/modificacion-ordenador.model";
import type {
  ConteosModificaciones,
  FiltroModificacionesOrdenador,
  ModificacionOrdenador,
  ResultadoListadoModificaciones,
} from "../../../models/modificacion-ordenador.model";
import { fechaCierreSolicitud } from "../../../models/solicitud.model";
import { ModificacionesService } from "../../../services/modificaciones.service";

type EstadoVista = "cargando" | "listo" | "error";

const CRITERIOS_INICIALES: FiltroModificacionesOrdenador = {
  estado: "por-aprobar",
  dependencia: "",
  tipoCambio: "",
  busqueda: "",
  desde: "",
  hasta: "",
  ordenNumero: "desc",
};

const OPCIONES_ESTADO: readonly { valor: string; etiqueta: string }[] = [
  { valor: "por-aprobar", etiqueta: "Pendientes de decisión" },
  { valor: "", etiqueta: "Todos los estados" },
  { valor: "aprobada", etiqueta: "Aprobadas" },
  { valor: "rechazada", etiqueta: "Rechazadas" },
];

function crearCamposFiltro(
  dependencias: readonly string[],
): readonly CampoFiltro[] {
  return [
    {
      clave: "busqueda",
      etiqueta: "Búsqueda rápida",
      tipo: "texto",
      placeholder: "MOD, número de solicitud, título o solicitante…",
    },
    {
      clave: "estado",
      etiqueta: "Estado",
      tipo: "select",
      opciones: OPCIONES_ESTADO,
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
      clave: "tipoCambio",
      etiqueta: "Tipo de cambio",
      tipo: "select",
      opciones: TIPOS_CAMBIO_MODIFICACION,
    },
    {
      clave: "desde",
      etiqueta: "Radicación desde",
      tipo: "fecha",
    },
    {
      clave: "hasta",
      etiqueta: "Radicación hasta",
      tipo: "fecha",
    },
  ];
}

/**
 * Bandeja de modificaciones por aprobar (O-04).
 *
 * Lista las modificaciones restringidas de las solicitudes asignadas al
 * ordenador de la sesión (RN-02). No decide: la acción principal navega a la
 * página de decisión. La tabla, el paginador y los estados de vista siguen el
 * patrón de O-01.
 */
@Component({
  selector: "app-bandeja-modificaciones",
  templateUrl: "./bandeja-modificaciones.component.html",
  styleUrls: ["./bandeja-modificaciones.component.scss"],
  standalone: false,
})
export class BandejaModificacionesComponent implements OnInit {
  constructor(
    private readonly servicio: ModificacionesService,
    readonly permisos: PermisosSolicitudService,
    private readonly rol: RolService,
    private readonly router: Router,
    private readonly alerta: AlertService,
    private readonly destroyRef: DestroyRef,
  ) {}

  readonly breadcrumb =
    "<p>Gestión Proveedor › Cotizaciones › <b>Modificaciones por aprobar</b></p>";
  readonly ACCIONES = ACCIONES_MODIFICACION;
  readonly hayColumnaAcciones = computed(() =>
    this.rol.mostrarAcciones(ACCIONES_MODIFICACION_POR_ROL_Y_ESTADO),
  );

  readonly grupos = GRUPOS_FILTRO_MODIFICACION;
  readonly opcionesPorPagina: readonly number[] = [10, 25, 50];
  readonly esqueleto: readonly number[] = [1, 2, 3, 4, 5];

  camposFiltro: readonly CampoFiltro[] = crearCamposFiltro([]);

  vista = signal<EstadoVista>("cargando");
  modificaciones: readonly ModificacionOrdenador[] = [];
  total = 0;
  conteos: ConteosModificaciones = conteosModificacionesVacios();
  dependencias: readonly string[] = [];
  pagina = 0;
  porPagina = 10;
  filtroRapidoActivo: GrupoFiltroModificacion = "por-aprobar";
  criterios: FiltroModificacionesOrdenador = { ...CRITERIOS_INICIALES };
  mensajeError = "";
  resultadoAnunciable = "";
  filaMenuAbierto: string | null = null;
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
      .listar(this.criterios, this.pagina, this.porPagina)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado: ResultadoListadoModificaciones) => {
          this.modificaciones = resultado.modificaciones;
          this.total = resultado.total;
          this.conteos = resultado.conteos;
          this.dependencias = resultado.dependencias;
          if (!this.dependenciasCargadas) {
            this.camposFiltro = crearCamposFiltro(resultado.dependencias);
            this.dependenciasCargadas = true;
          }
          this.vista.set("listo");
          this.resultadoAnunciable = `${resultado.total} ${
            resultado.total === 1 ? "modificación" : "modificaciones"
          } para decisión.`;
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
    return `Criterio activo: ${activo}. Solo se listan modificaciones de solicitudes asignadas a su despacho (RN-02); el alcance permitido es ítems y fecha de cierre (RN-30).`;
  }

  get cierresProximos(): number {
    return this.modificaciones.filter(
      (fila) => fila.estado === "por-aprobar" && this.cierreProximo(fila),
    ).length;
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
      this.criterios.estado !== CRITERIOS_INICIALES.estado ||
      this.criterios.dependencia !== "" ||
      this.criterios.tipoCambio !== "" ||
      this.criterios.busqueda.trim() !== "" ||
      this.criterios.desde !== "" ||
      this.criterios.hasta !== ""
    );
  }

  filtrar(valores: Record<string, string>): void {
    this.criterios = {
      ...this.criterios,
      estado: valores["estado"] ?? "",
      dependencia: valores["dependencia"] ?? "",
      tipoCambio: valores["tipoCambio"] ?? "",
      busqueda: valores["busqueda"] ?? "",
      desde: valores["desde"] ?? "",
      hasta: valores["hasta"] ?? "",
    };
    this.filtroRapidoActivo =
      (this.criterios.estado as GrupoFiltroModificacion) || "todas";
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
      estado: grupo.valor === "todas" ? "" : grupo.valor,
    };
    this.pagina = 0;
    this.cargar();
  }

  limpiar(): void {
    this.criterios = { ...CRITERIOS_INICIALES };
    this.filtroRapidoActivo = "por-aprobar";
    this.pagina = 0;
    this.cargar();
  }

  ordenarPorRadicado(): void {
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

  accionesDe(fila: ModificacionOrdenador): readonly AccionModificacion[] {
    return this.permisos.accionesModificacionPermitidas(fila);
  }

  abrirMenuAcciones(radicado: string): void {
    this.filaMenuAbierto = radicado;
  }

  cerrarMenuAcciones(): void {
    this.filaMenuAbierto = null;
  }

  etiquetaAccion(accion: AccionModificacion): string {
    return this.permisos.etiquetaAccionModificacion(accion);
  }

  ejecutarAccion(
    accion: AccionModificacion,
    fila: ModificacionOrdenador,
  ): void {
    const comandos = this.permisos.rutaAccionModificacion(accion, fila);
    if (!comandos) {
      void this.alerta.showAlert(
        this.etiquetaAccion(accion),
        "Esta acción aún no está implementada.",
      );
      return;
    }
    void this.router.navigate(comandos);
  }

  abrirProceso(fila: ModificacionOrdenador): void {
    this.ejecutarAccion("ver-proceso", fila);
  }

  estadoDe(fila: ModificacionOrdenador) {
    return fila.estado;
  }

  versionDe(fila: ModificacionOrdenador): string {
    if (fila.estado === "rechazada") {
      return `${fila.versionAnterior} (sin cambios)`;
    }
    if (fila.estado === "aprobada") {
      return `${fila.versionAnterior} → ${fila.versionPropuesta}`;
    }
    return `${fila.versionAnterior} → ${fila.versionPropuesta} (propuesta)`;
  }

  fechaSolicitud(fila: ModificacionOrdenador): string {
    return fila.propuesta.solicitadaEl.split(" ")[0] ?? "—";
  }

  horaSolicitud(fila: ModificacionOrdenador): string {
    return fila.propuesta.solicitadaEl.split(" ")[1] ?? "";
  }

  cierreDe(fila: ModificacionOrdenador): string {
    return fila.estado === "aprobada"
      ? (fila.cierrePropuesto ?? fila.cierreVigente ?? "—")
      : (fila.cierreVigente ?? "—");
  }

  /** true si el cierre del proceso vence en las próximas 48 horas. */
  cierreProximo(fila: ModificacionOrdenador): boolean {
    const marca = fechaCierreSolicitud(fila.cierreVigente);
    if (marca === null) {
      return false;
    }
    const restante = marca - Date.now();
    return restante > 0 && restante <= 48 * 3_600_000;
  }

  /** Etiqueta del cierre vigente ("Cierra en 48 h", "Cerrada", …). */
  etiquetaCierre(fila: ModificacionOrdenador): string {
    const marca = fechaCierreSolicitud(fila.cierreVigente);
    if (marca === null) {
      return "Sin fecha";
    }
    const restante = marca - Date.now();
    if (restante <= 0) {
      return "Cerrada";
    }
    if (restante <= 24 * 3_600_000) {
      return "Cierra hoy";
    }
    if (restante <= 48 * 3_600_000) {
      return "Cierra en 48 h";
    }
    const dias = Math.ceil(restante / (24 * 3_600_000));
    return `Cierra en ${dias} días`;
  }

  cambiosDe(fila: ModificacionOrdenador): string {
    const items = fila.cambiosItems;
    const cierre = fila.cambiosCierre;
    const partes: string[] = [];
    if (items > 0) {
      partes.push(`${items} ${items === 1 ? "cambio" : "cambios"} de ítems`);
    }
    if (cierre > 0) {
      partes.push("fecha de cierre");
    }
    return partes.join(" · ") || "Sin cambios";
  }
}
