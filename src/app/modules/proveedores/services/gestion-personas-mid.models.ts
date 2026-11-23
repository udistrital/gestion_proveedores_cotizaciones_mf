export interface DatosIdentificacionMid {
  Numero: string;
  TipoDocumentoId?: number;
  DigitoVerficacion?: number;
  CiudadExpedicion?: number;
  FechaExpedicion?: string;
}

export interface TerceroMid {
  NombreCompleto?: string;
  PrimerNombre?: string;
  SegundoNombre?: string;
  PrimerApellido?: string;
  SegundoApellido?: string;
  FechaNacimiento?: string;
  TipoContribuyenteId?: number;
  UsuarioWso2?: string;
  DatosIdentificacion?: DatosIdentificacionMid[];
}

export interface ContactoMid {
  Id?: number;
  NombreContacto?: string;
  ValorEspecifico?: string;
  TipoCanalContactoId?: number;
  Proposito?: string;
  Extension?: string;
  UsuarioModificacionId?: number;
}

export interface CuentaBancariaMid {
  Id?: number;
  EntidadBancariaId?: number;
  TipoCuentaId?: number;
  NumeroCuenta?: string;
  ContactoId?: number;
  MontoCapitalAutorizado?: number;
  UsuarioModificacionId?: number;
}

export interface DocumentoMid {
  TipoDocumentoId?: number;
  Enlace?: string;
}

export interface ProveedorNaturalMid {
  PaisNacimientoId?: number;
  Cargo?: number;
  MedicinaPrepagada?: boolean;
  ValorUvtPrepagada?: number;
  InteresViviendaAfc?: number;
  DependienteHijoMejorEdad?: boolean;
  DependienteHijoMenos23Estudiando?: boolean;
  DependienteHijoMas23Discapacitado?: boolean;
  DependienteConyuge?: boolean;
  DependientePadreOHermano?: boolean;
  Pensionado?: boolean;
  ValorAfc?: number;
  ResponsableIva?: boolean;
  ResideColombia?: boolean;
  PensionVoluntaria?: boolean;
  ValorPensionVoluntaria?: number;
  ExperienciaLaboral?: number;
  ExperienciaProfesional?: number;
  UsuarioModificacionId?: number;
}

export interface ProveedorJuridicoMid {
  ProcedenciaEmpresaId?: number;
  CiudadOrigenId?: number;
  PaisOrigenId?: number;
  CodigoPostal?: string;
  TipoConformacionId?: number;
  ExclusividadProducto?: boolean;
  RegimenContributivo?: number;
  Pyme?: boolean;
  RegistroMercantil?: boolean;
  SujetoRetencion?: boolean;
  AgenteRetenedor?: boolean;
  ResponsableIca?: boolean;
  ResponsableIva?: boolean;
  UsuarioModificacionId?: number;
}

interface ProveedorMidBase {
  DescripcionPortafolio?: string | null;
  Tercero?: TerceroMid;
  Contacto?: ContactoMid[];
  CuentaBancaria?: CuentaBancariaMid[];
  ActividadEconomicaProveedor?: Array<{
    ActividadEconomicaId: number;
    UsuarioModificacionId?: number;
  }>;
}

export interface ProveedorNaturalMidRequest extends ProveedorMidBase {
  TipoProveedor: number;
  ProveedorNatural?: ProveedorNaturalMid;
}

export interface ProveedorJuridicoMidRequest extends ProveedorMidBase {
  TipoProveedor: number;
  ProveedorJuridico?: ProveedorJuridicoMid;
}

export type NuevoProveedorNaturalMidPayload = Omit<
  ProveedorNaturalMidRequest,
  "TipoProveedor"
>;

export type NuevoProveedorJuridicoMidPayload = Omit<
  ProveedorJuridicoMidRequest,
  "TipoProveedor"
>;

export interface ConsultaProveedorMidRequest {
  id: number;
  fields?: string[];
}

export interface TerceroMidActualizacion extends TerceroMid {
  Id?: number;
}

export interface CuentaBancariaMidActualizacion extends CuentaBancariaMid {
  Id?: number;
}

export interface ProveedorNaturalMidActualizacion
  extends ProveedorNaturalMid {
  Id?: number;
}

export interface ProveedorJuridicoMidActualizacion
  extends ProveedorJuridicoMid {
  Id?: number;
}

interface ActualizacionProveedorMidBase {
  Id: number;
  TerceroId?: number;
  TipoProveedor: number;
  Tercero?: TerceroMidActualizacion;
  DescripcionPortafolio?: string | null;
  CuentaBancaria?: CuentaBancariaMidActualizacion[];
  ActividadEconomicaProveedor?: Array<{
    ActividadEconomicaId: number;
    UsuarioModificacionId?: number;
  }>;
}

export interface ActualizarProveedorNaturalMidPayload
  extends ActualizacionProveedorMidBase {
  ProveedorNatural?: ProveedorNaturalMidActualizacion;
}

export interface ActualizarProveedorJuridicoMidPayload
  extends ActualizacionProveedorMidBase {
  ProveedorJuridico?: ProveedorJuridicoMidActualizacion;
}

export interface ErrorMaterializacionMid {
  path?: string;
  service?: string;
  message?: string;
  kind?: string;
}

export interface ProveedorMidMaterializado {
  [propiedad: string]: unknown;
  Id?: number;
  TerceroId?: number;
  TipoProveedor?: number;
}

export interface RespuestaMid<TData = ProveedorMidMaterializado> {
  Success: boolean;
  Status: string;
  Message: string;
  Data: TData | null;
  MetaData?: {
    Errors?: ErrorMaterializacionMid[];
  };
}

export interface MapeoPayloadMid<TPayload> {
  payload: TPayload;
  omisiones: string[];
}
