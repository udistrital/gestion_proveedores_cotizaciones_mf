import {
  ActualizarProveedorJuridicoMidPayload,
  ActualizarProveedorNaturalMidPayload,
  ContactoMid,
  DatosIdentificacionMid,
  DocumentoMid,
  MapeoPayloadMid,
  NuevoProveedorJuridicoMidPayload,
  NuevoProveedorNaturalMidPayload,
  CuentaBancariaMid,
  CuentaBancariaMidActualizacion,
  ProveedorMidMaterializado,
  ProveedorJuridicoMid,
  ProveedorNaturalMid,
  ProveedorJuridicoMidActualizacion,
  ProveedorNaturalMidActualizacion,
  TerceroMidActualizacion,
  TerceroMid,
} from "./gestion-personas-mid.models";
import { textoPlanoDesdeHtml } from "src/app/shared/utils/texto-plano";

function registro(
  valor: unknown,
  nombre: string,
): Record<string, unknown> {
  if (
    typeof valor !== "object"
    || valor === null
    || Array.isArray(valor)
  ) {
    throw new Error(`No fue posible leer los datos de ${nombre}.`);
  }
  return valor as Record<string, unknown>;
}

function registroOpcional(
  valor: unknown,
  nombre: string,
): Record<string, unknown> | undefined {
  if (valor === undefined || valor === null) {
    return undefined;
  }
  return registro(valor, nombre);
}

function textoOpcional(
  datos: Record<string, unknown>,
  campo: string,
): string | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  if (typeof valor !== "string") {
    throw new Error(`El campo ${campo} debe ser una cadena.`);
  }
  const texto = valor.trim();
  return texto.length > 0 ? texto : undefined;
}

function textoActualizacion(
  datos: Record<string, unknown>,
  campo: string,
): string | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null) {
    return undefined;
  }
  if (typeof valor !== "string") {
    throw new Error(`El campo ${campo} debe ser una cadena.`);
  }
  return valor;
}

function textoNullableActualizacion(
  datos: Record<string, unknown>,
  campo: string,
): string | null | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null) {
    return valor;
  }
  if (typeof valor !== "string") {
    throw new Error(`El campo ${campo} debe ser una cadena.`);
  }
  return valor;
}

function entero(
  valor: unknown,
  campo: string,
  minimo: number,
): number {
  let numero: number;
  if (typeof valor === "number") {
    numero = valor;
  } else if (typeof valor === "string" && /^\d+$/.test(valor.trim())) {
    numero = Number(valor.trim());
  } else {
    throw new Error(`El campo ${campo} debe ser un número entero.`);
  }
  if (!Number.isSafeInteger(numero) || numero < minimo) {
    throw new Error(`El campo ${campo} debe ser un número entero válido.`);
  }
  return numero;
}

function enteroOpcional(
  valor: unknown,
  campo: string,
  minimo: number,
): number | undefined {
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  return entero(valor, campo, minimo);
}

function enteroNumericoOpcional(
  valor: unknown,
  campo: string,
  minimo: number,
): number | undefined {
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  if (
    typeof valor !== "number"
    || !Number.isSafeInteger(valor)
    || valor < minimo
  ) {
    throw new Error(`El campo ${campo} debe ser un número entero válido.`);
  }
  return valor;
}

function fechaOpcional(
  datos: Record<string, unknown>,
  campo: string,
): string | undefined {
  const fecha = textoOpcional(datos, campo);
  if (!fecha) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error(`El campo ${campo} debe tener formato AAAA-MM-DD.`);
  }
  const fechaValidada = new Date(`${fecha}T00:00:00Z`);
  if (
    Number.isNaN(fechaValidada.getTime())
    || fechaValidada.toISOString().slice(0, 10) !== fecha
  ) {
    throw new Error(`El campo ${campo} no contiene una fecha válida.`);
  }
  return fecha;
}

function booleanoOpcional(
  datos: Record<string, unknown>,
  campo: string,
): boolean | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null || valor === "") {
    return undefined;
  }
  if (typeof valor !== "boolean") {
    throw new Error(`El campo ${campo} debe ser una respuesta Sí/No.`);
  }
  return valor;
}

function idMaterializado(
  datos: Record<string, unknown>,
  campo: string,
  entidad: string,
): number {
  const id = enteroNumericoOpcional(datos[campo], `${entidad}.${campo}`, 1);
  if (id === undefined) {
    throw new Error(
      `La consulta no devolvió el identificador de ${entidad}; no se enviará PATCH para evitar crear otra entidad.`,
    );
  }
  return id;
}

function esModalidad(
  datos: ProveedorMidMaterializado,
  rama: "ProveedorNatural" | "ProveedorJuridico",
): Record<string, unknown> | undefined {
  const detalle = registroOpcional(datos[rama], rama);
  const otraRama =
    rama === "ProveedorNatural" ? "ProveedorJuridico" : "ProveedorNatural";
  if (datos[otraRama] !== undefined && datos[otraRama] !== null) {
    throw new Error(`La respuesta consultada no corresponde a ${rama}.`);
  }
  return detalle;
}

function agregarTexto(
  destino: Record<string, unknown>,
  datos: Record<string, unknown>,
  campoOrigen: string,
  campoDestino: string,
): void {
  const valor = textoOpcional(datos, campoOrigen);
  if (valor !== undefined) {
    destino[campoDestino] = valor;
  }
}

function primeraRelacion(
  datos: Record<string, unknown>,
  campo: string,
): Record<string, unknown> | undefined {
  const valor = datos[campo];
  if (valor === undefined || valor === null) {
    return undefined;
  }
  if (!Array.isArray(valor)) {
    throw new Error(`La relación ${campo} no tiene el formato documentado.`);
  }
  return valor.length === 0
    ? undefined
    : registro(valor[0], campo);
}

function agregarEntero(
  destino: Record<string, unknown>,
  datos: Record<string, unknown>,
  campoOrigen: string,
  campoDestino: string,
  minimo: number,
): void {
  const valor = enteroNumericoOpcional(datos[campoOrigen], campoOrigen, minimo);
  if (valor !== undefined) {
    destino[campoDestino] = valor;
  }
}

function agregarBooleano(
  destino: Record<string, unknown>,
  datos: Record<string, unknown>,
  campoOrigen: string,
  campoDestino: string,
): void {
  const valor = booleanoOpcional(datos, campoOrigen);
  if (valor !== undefined) {
    destino[campoDestino] = valor;
  }
}

function idsActividadEconomica(valor: unknown): number[] {
  if (valor === undefined || valor === null) {
    return [];
  }
  if (!Array.isArray(valor)) {
    throw new Error(
      "La relación ActividadEconomicaProveedor no tiene el formato documentado.",
    );
  }
  return valor.map((elemento, indice) => {
    const actividad = registro(elemento, `ActividadEconomicaProveedor[${indice}]`);
    const id = enteroNumericoOpcional(
      actividad["ActividadEconomicaId"],
      "ActividadEconomicaId",
      1,
    );
    if (id === undefined) {
      throw new Error(
        "Una actividad económica consultada no contiene ActividadEconomicaId.",
      );
    }
    return id;
  });
}

function registrosRelacion(
  datos: Record<string, unknown>,
  campo: string,
): Record<string, unknown>[] {
  const valor = datos[campo];
  if (valor === undefined || valor === null) {
    return [];
  }
  if (!Array.isArray(valor)) {
    throw new Error(`La relación ${campo} no tiene el formato documentado.`);
  }
  return valor.map((elemento, indice) =>
    registro(elemento, `${campo}[${indice}]`),
  );
}

export function mapearColeccionesConsultaProveedorMid(
  datos: ProveedorMidMaterializado,
): {
  contactos: ContactoMid[];
  cuentasBancarias: CuentaBancariaMid[];
  documentos: DocumentoMid[];
} {
  const contactos = registrosRelacion(datos, "Contacto").map((datosContacto) => {
    const contacto: ContactoMid = {};
    const id = enteroNumericoOpcional(datosContacto["Id"], "Contacto.Id", 1);
    const tipoCanalContactoId = enteroNumericoOpcional(
      datosContacto["TipoCanalContactoId"],
      "Contacto.TipoCanalContactoId",
      1,
    );
    if (id !== undefined) {
      contacto.Id = id;
    }
    if (tipoCanalContactoId !== undefined) {
      contacto.TipoCanalContactoId = tipoCanalContactoId;
    }
    for (const campo of [
      "NombreContacto",
      "ValorEspecifico",
      "Proposito",
      "Extension",
    ] as const) {
      const valor = textoOpcional(datosContacto, campo);
      if (valor !== undefined) {
        contacto[campo] = valor;
      }
    }
    return contacto;
  });

  const cuentasBancarias = registrosRelacion(datos, "CuentaBancaria").map(
    (datosCuenta) => {
      const cuenta: CuentaBancariaMid = {};
      for (const campo of [
        "Id",
        "EntidadBancariaId",
        "TipoCuentaId",
        "ContactoId",
      ] as const) {
        const valor = enteroNumericoOpcional(
          datosCuenta[campo],
          `CuentaBancaria.${campo}`,
          1,
        );
        if (valor !== undefined) {
          cuenta[campo] = valor;
        }
      }
      const numeroCuenta = textoOpcional(datosCuenta, "NumeroCuenta");
      if (numeroCuenta !== undefined) {
        cuenta.NumeroCuenta = numeroCuenta;
      }
      const monto = enteroNumericoOpcional(
        datosCuenta["MontoCapitalAutorizado"],
        "CuentaBancaria.MontoCapitalAutorizado",
        0,
      );
      if (monto !== undefined) {
        cuenta.MontoCapitalAutorizado = monto;
      }
      return cuenta;
    },
  );

  const documentos = registrosRelacion(datos, "Documento").map(
    (datosDocumento) => {
      const documento: DocumentoMid = {};
      const tipoDocumentoId = enteroNumericoOpcional(
        datosDocumento["TipoDocumentoId"],
        "Documento.TipoDocumentoId",
        1,
      );
      const enlace = textoOpcional(datosDocumento, "Enlace");
      if (tipoDocumentoId !== undefined) {
        documento.TipoDocumentoId = tipoDocumentoId;
      }
      if (enlace !== undefined) {
        documento.Enlace = enlace;
      }
      return documento;
    },
  );

  return { contactos, cuentasBancarias, documentos };
}

function actividadesNuevas(
  idsFormulario: unknown,
  datosConsultados: ProveedorMidMaterializado,
): Array<{ ActividadEconomicaId: number }> {
  if (idsFormulario === undefined || idsFormulario === null) {
    return [];
  }
  if (!Array.isArray(idsFormulario)) {
    throw new Error("Las actividades económicas deben ser una lista de IDs.");
  }
  const idsExistentes = new Set(
    idsActividadEconomica(datosConsultados["ActividadEconomicaProveedor"]),
  );
  const nuevos = new Set<number>();
  for (const [indice, valor] of idsFormulario.entries()) {
    const id = entero(valor, `ActividadEconomicaId[${indice}]`, 1);
    if (!idsExistentes.has(id)) {
      nuevos.add(id);
    }
  }
  return [...nuevos].map((ActividadEconomicaId) => ({ ActividadEconomicaId }));
}

export function mapearConsultaPersonaNaturalMid(
  datos: ProveedorMidMaterializado,
): Record<string, unknown> {
  const tercero = registroOpcional(datos["Tercero"], "Tercero") ?? {};
  const detalle = esModalidad(datos, "ProveedorNatural") ?? {};
  const identificacion: Record<string, unknown> = {};
  const experiencia: Record<string, unknown> = {};
  const afiliacionesFinanzas: Record<string, unknown> = {};
  const actividadDeclaracion: Record<string, unknown> = {};
  const tributario: Record<string, unknown> = {};
  const documento = primeraRelacion(tercero, "DatosIdentificacion");

  agregarTexto(identificacion, tercero, "PrimerNombre", "primerNombre");
  agregarTexto(identificacion, tercero, "SegundoNombre", "segundoNombre");
  agregarTexto(identificacion, tercero, "PrimerApellido", "primerApellido");
  agregarTexto(identificacion, tercero, "SegundoApellido", "segundoApellido");
  const fechaNacimiento = fechaOpcional(tercero, "FechaNacimiento");
  if (fechaNacimiento !== undefined) {
    identificacion["fechaNacimiento"] = fechaNacimiento;
  }
  if (documento) {
    agregarTexto(identificacion, documento, "Numero", "numeroDocumento");
    agregarEntero(
      identificacion,
      documento,
      "TipoDocumentoId",
      "tipoDocumento",
      1,
    );
    agregarEntero(
      identificacion,
      documento,
      "CiudadExpedicion",
      "ciudadExpedicion",
      1,
    );
    agregarTexto(
      identificacion,
      documento,
      "FechaExpedicion",
      "fechaExpedicion",
    );
    const digitoVerificacion = enteroNumericoOpcional(
      documento["DigitoVerficacion"],
      "DigitoVerficacion",
      0,
    );
    if (digitoVerificacion !== undefined) {
      identificacion["dv"] = String(digitoVerificacion);
    }
  }

  agregarEntero(
    identificacion,
    detalle,
    "PaisNacimientoId",
    "paisNacimiento",
    1,
  );
  const experienciaLaboral = enteroNumericoOpcional(
    detalle["ExperienciaLaboral"],
    "ExperienciaLaboral",
    0,
  );
  if (experienciaLaboral !== undefined) {
    experiencia["experienciaLaboralTotal"] = experienciaLaboral;
  }
  const experienciaProfesional = enteroNumericoOpcional(
    detalle["ExperienciaProfesional"],
    "ExperienciaProfesional",
    0,
  );
  if (experienciaProfesional !== undefined) {
    experiencia["experienciaProfesional"] = experienciaProfesional;
  }
  const cuenta = primeraRelacion(datos, "CuentaBancaria");
  if (cuenta) {
    agregarEntero(
      afiliacionesFinanzas,
      cuenta,
      "EntidadBancariaId",
      "entidadBancaria",
      1,
    );
    agregarEntero(
      afiliacionesFinanzas,
      cuenta,
      "TipoCuentaId",
      "tipoCuenta",
      1,
    );
    agregarTexto(
      afiliacionesFinanzas,
      cuenta,
      "NumeroCuenta",
      "numeroCuentaBancaria",
    );
    agregarEntero(
      afiliacionesFinanzas,
      cuenta,
      "MontoCapitalAutorizado",
      "capitalAutorizadoPatrimonio",
      0,
    );
  }
  agregarBooleano(tributario, detalle, "MedicinaPrepagada", "medicinaPrepagada");
  agregarBooleano(tributario, detalle, "ResponsableIva", "responsableIva");
  agregarBooleano(tributario, detalle, "ResideColombia", "resideFiscalmenteColombia");
  agregarBooleano(tributario, detalle, "PensionVoluntaria", "aportesPensionVoluntaria");
  agregarBooleano(
    afiliacionesFinanzas,
    detalle,
    "Pensionado",
    "pensionadoAsignacionRetiro",
  );
  agregarTexto(
    actividadDeclaracion,
    datos,
    "DescripcionPortafolio",
    "portafolioCapacidadEntrega",
  );
  const actividades = idsActividadEconomica(
    datos["ActividadEconomicaProveedor"],
  );
  if (actividades.length > 0) {
    actividadDeclaracion["actividadesCiiu"] = actividades;
  }

  return {
    identificacion,
    experiencia,
    tributario,
    afiliacionesFinanzas,
    actividadDeclaracion,
  };
}

export function mapearConsultaPersonaJuridicaMid(
  datos: ProveedorMidMaterializado,
): Record<string, unknown> {
  const tercero = registroOpcional(datos["Tercero"], "Tercero") ?? {};
  const detalle = esModalidad(datos, "ProveedorJuridico") ?? {};
  const formulario: Record<string, unknown> = {};
  const documento = primeraRelacion(tercero, "DatosIdentificacion");
  const cuenta = primeraRelacion(datos, "CuentaBancaria");

  agregarTexto(formulario, tercero, "NombreCompleto", "razonSocial");
  if (documento) {
    agregarTexto(formulario, documento, "Numero", "nit");
    const digitoVerificacion = enteroNumericoOpcional(
      documento["DigitoVerficacion"],
      "DigitoVerficacion",
      0,
    );
    if (digitoVerificacion !== undefined) {
      formulario["digitoVerificacion"] = String(digitoVerificacion);
    }
  }
  agregarEntero(formulario, detalle, "ProcedenciaEmpresaId", "procedencia", 1);
  agregarEntero(
    formulario,
    detalle,
    "RegimenContributivo",
    "regimenContributivo",
    1,
  );
  for (const [campoMid, campoFormulario] of [
    ["ExclusividadProducto", "exclusividadImportacion"],
    ["Pyme", "clasificacionPyme"],
    ["RegistroMercantil", "registroMercantilActivo"],
    ["SujetoRetencion", "sujetoRetencion"],
    ["AgenteRetenedor", "agenteRetenedor"],
    ["ResponsableIca", "responsableIca"],
    ["ResponsableIva", "responsableIva"],
  ] as const) {
    agregarBooleano(formulario, detalle, campoMid, campoFormulario);
  }
  agregarTexto(
    formulario,
    datos,
    "DescripcionPortafolio",
    "descripcionServicios",
  );
  if (cuenta) {
    agregarEntero(formulario, cuenta, "EntidadBancariaId", "banco", 1);
    agregarEntero(formulario, cuenta, "TipoCuentaId", "tipoCuenta", 1);
    agregarTexto(formulario, cuenta, "NumeroCuenta", "numeroCuenta");
    agregarEntero(
      formulario,
      cuenta,
      "MontoCapitalAutorizado",
      "capitalAutorizado",
      0,
    );
  }

  const actividades = idsActividadEconomica(
    datos["ActividadEconomicaProveedor"],
  );
  if (actividades.length > 0) {
    formulario["actividadesCiiu"] = actividades;
  }

  return formulario;
}

function baseActualizacion(
  datos: ProveedorMidMaterializado,
  rama: "ProveedorNatural" | "ProveedorJuridico",
): {
  Id: number;
  TerceroId?: number;
  TipoProveedor: number;
  TerceroIdMaterializado?: number;
  DetalleId?: number;
} {
  const proveedorId = idMaterializado(datos, "Id", "Proveedor");
  const terceroId = enteroNumericoOpcional(
    datos.TerceroId,
    "Proveedor.TerceroId",
    1,
  );
  const tipoProveedor = idMaterializado(datos, "TipoProveedor", "Proveedor");
  const tercero = registroOpcional(datos["Tercero"], "Tercero");
  const terceroIdMaterializado = tercero
    ? enteroNumericoOpcional(tercero["Id"], "Tercero.Id", 1) ?? terceroId
    : terceroId;
  const detalle = esModalidad(datos, rama);
  const detalleId = detalle
    ? enteroNumericoOpcional(detalle["Id"], `${rama}.Id`, 1)
    : undefined;

  if (
    terceroId !== undefined
    && terceroIdMaterializado !== undefined
    && terceroId !== terceroIdMaterializado
  ) {
    throw new Error(
      "TerceroId no coincide con Tercero.Id; no se enviará PATCH con una relación ambigua.",
    );
  }

  return {
    Id: proveedorId,
    TerceroId: terceroId,
    TipoProveedor: tipoProveedor,
    TerceroIdMaterializado: terceroIdMaterializado,
    DetalleId: detalleId,
  };
}

export function mapearActualizacionPersonaNaturalMid(
  valorFormulario: unknown,
  datosConsultados: ProveedorMidMaterializado,
): MapeoPayloadMid<ActualizarProveedorNaturalMidPayload> {
  const formulario = registro(valorFormulario, "persona natural");
  const identificacion = registro(
    formulario["identificacion"],
    "identificación",
  );
  const experiencia = registro(formulario["experiencia"], "experiencia");
  const finanzas = registro(
    formulario["afiliacionesFinanzas"],
    "información bancaria",
  );
  const tributario = registro(formulario["tributario"], "información tributaria");
  const actividad = registro(
    formulario["actividadDeclaracion"],
    "actividad",
  );
  const base = baseActualizacion(datosConsultados, "ProveedorNatural");
  const tercero: TerceroMidActualizacion = {};
  const detalle: ProveedorNaturalMidActualizacion = {};
  if (base.TerceroIdMaterializado !== undefined) {
    tercero.Id = base.TerceroIdMaterializado;
  }
  if (base.DetalleId !== undefined) {
    detalle.Id = base.DetalleId;
  }
  const omisiones = [
    "DatosIdentificacion y Contacto no se modifican en PATCH para evitar duplicar identificaciones o crear contactos sin TipoCanalContactoId.",
    "La vista representa una cuenta bancaria; las cuentas adicionales consultadas no se modifican ni eliminan.",
    "Las actividades económicas quitadas del formulario no se borran porque el contrato no ofrece una operación de eliminación.",
    "La actividad económica principal no se distingue: el contrato solo permite registrar los IDs de las actividades.",
    "Los campos omitidos no se borran; el contrato no define el uso de null para limpiar valores.",
  ];
  let camposActualizados = 0;

  for (const [campoFormulario, campoMid] of [
    ["primerNombre", "PrimerNombre"],
    ["segundoNombre", "SegundoNombre"],
    ["primerApellido", "PrimerApellido"],
    ["segundoApellido", "SegundoApellido"],
  ] as const) {
    const valor = textoActualizacion(identificacion, campoFormulario);
    if (valor !== undefined) {
      tercero[campoMid] = valor;
      camposActualizados += 1;
    }
  }
  const fechaNacimiento = fechaOpcional(identificacion, "fechaNacimiento");
  if (fechaNacimiento !== undefined) {
    tercero.FechaNacimiento = fechaNacimiento;
    camposActualizados += 1;
  }

  for (const [campoFormulario, campoMid] of [
    ["experienciaLaboralTotal", "ExperienciaLaboral"],
    ["experienciaProfesional", "ExperienciaProfesional"],
  ] as const) {
    const valor = enteroOpcional(experiencia[campoFormulario], campoMid, 0);
    if (valor !== undefined) {
      detalle[campoMid] = valor;
      camposActualizados += 1;
    }
  }

  const paisNacimientoId = enteroOpcional(
    identificacion["paisNacimiento"],
    "PaisNacimientoId",
    1,
  );
  if (paisNacimientoId !== undefined) {
    detalle.PaisNacimientoId = paisNacimientoId;
    camposActualizados += 1;
  }
  for (const [campoFormulario, campoMid] of [
    ["medicinaPrepagada", "MedicinaPrepagada"],
    ["responsableIva", "ResponsableIva"],
    ["resideFiscalmenteColombia", "ResideColombia"],
    ["aportesPensionVoluntaria", "PensionVoluntaria"],
  ] as const) {
    const valor = booleanoOpcional(tributario, campoFormulario);
    if (valor !== undefined) {
      detalle[campoMid] = valor;
      camposActualizados += 1;
    }
  }
  const pensionado = booleanoOpcional(
    finanzas,
    "pensionadoAsignacionRetiro",
  );
  if (pensionado !== undefined) {
    detalle.Pensionado = pensionado;
    camposActualizados += 1;
  }

  const descripcionPortafolioHtml = textoNullableActualizacion(
    actividad,
    "portafolioCapacidadEntrega",
  );
  // El editor enriquecido guarda HTML; el MID espera texto legible.
  const descripcionPortafolio = descripcionPortafolioHtml === null
    || descripcionPortafolioHtml === undefined
    ? descripcionPortafolioHtml
    : textoPlanoDesdeHtml(descripcionPortafolioHtml);
  if (descripcionPortafolio !== undefined) {
    camposActualizados += 1;
  }

  const cuentaConsultada = primeraRelacion(datosConsultados, "CuentaBancaria");
  const cuentaId = cuentaConsultada
    ? idMaterializado(cuentaConsultada, "Id", "CuentaBancaria")
    : undefined;
  const cuentaBancaria: CuentaBancariaMidActualizacion = cuentaId !== undefined
    ? { Id: cuentaId }
    : {};
  const entidadBancariaId = enteroNumericoOpcional(
    finanzas["entidadBancaria"],
    "EntidadBancariaId",
    1,
  );
  if (entidadBancariaId !== undefined) {
    cuentaBancaria.EntidadBancariaId = entidadBancariaId;
    camposActualizados += 1;
  }
  const tipoCuentaId = enteroNumericoOpcional(
    finanzas["tipoCuenta"],
    "TipoCuentaId",
    1,
  );
  if (tipoCuentaId !== undefined) {
    cuentaBancaria.TipoCuentaId = tipoCuentaId;
    camposActualizados += 1;
  }
  const numeroCuenta = textoActualizacion(finanzas, "numeroCuentaBancaria");
  if (numeroCuenta !== undefined) {
    cuentaBancaria.NumeroCuenta = numeroCuenta;
    camposActualizados += 1;
  }
  const montoCapitalAutorizado = enteroOpcional(
    finanzas["capitalAutorizadoPatrimonio"],
    "MontoCapitalAutorizado",
    0,
  );
  if (montoCapitalAutorizado !== undefined) {
    cuentaBancaria.MontoCapitalAutorizado = montoCapitalAutorizado;
    camposActualizados += 1;
  }
  if (cuentaId === undefined && Object.keys(cuentaBancaria).length === 0) {
    omisiones.push(
      "CuentaBancaria omitida: el paso no contiene los campos bancarios para crearla.",
    );
  }
  const actividades = actividadesNuevas(
    actividad["actividadesCiiu"],
    datosConsultados,
  );
  camposActualizados += actividades.length;

  if (camposActualizados === 0) {
    throw new Error(
      "No hay campos compatibles con el MID para actualizar en Persona Natural.",
    );
  }

  const payload: ActualizarProveedorNaturalMidPayload = {
    Id: base.Id,
    TipoProveedor: base.TipoProveedor,
  };
  if (base.TerceroId !== undefined) {
    payload.TerceroId = base.TerceroId;
  }
  if (Object.keys(tercero).length > 0) {
    payload.Tercero = tercero;
  }
  if (Object.keys(detalle).length > 0) {
    payload.ProveedorNatural = detalle;
  }
  if (descripcionPortafolio !== undefined) {
    payload.DescripcionPortafolio = descripcionPortafolio;
  }
  if (Object.keys(cuentaBancaria).length > (cuentaId === undefined ? 0 : 1)) {
    payload.CuentaBancaria = [cuentaBancaria];
  } else if (cuentaId !== undefined) {
    omisiones.push(
      "CuentaBancaria no modificada: no hay campos bancarios editables con valor.",
    );
  }
  if (actividades.length > 0) {
    payload.ActividadEconomicaProveedor = actividades;
  }

  return {
    payload,
    omisiones,
  };
}

export function mapearActualizacionPersonaJuridicaMid(
  valorFormulario: unknown,
  datosConsultados: ProveedorMidMaterializado,
): MapeoPayloadMid<ActualizarProveedorJuridicoMidPayload> {
  const formulario = registro(valorFormulario, "persona jurídica");
  const base = baseActualizacion(datosConsultados, "ProveedorJuridico");
  const cuentaConsultada = primeraRelacion(datosConsultados, "CuentaBancaria");
  const tercero: TerceroMidActualizacion = {};
  const detalle: ProveedorJuridicoMidActualizacion = {};
  if (base.TerceroIdMaterializado !== undefined) {
    tercero.Id = base.TerceroIdMaterializado;
  }
  if (base.DetalleId !== undefined) {
    detalle.Id = base.DetalleId;
  }
  const omisiones = [
    "DatosIdentificacion y Contacto se omiten en PATCH; no se envían propiedades documentales con equivalencia no confirmada ni contactos sin valores contractuales confirmados.",
    "La vista representa una cuenta bancaria; las cuentas adicionales consultadas no se modifican ni eliminan.",
    "La actividad económica principal no se distingue: el contrato solo permite registrar los IDs de las actividades.",
    "Los campos omitidos no se borran; el contrato no define el uso de null para limpiar valores.",
  ];
  let camposActualizados = 0;

  const razonSocial = textoActualizacion(formulario, "razonSocial");
  if (razonSocial !== undefined) {
    tercero.NombreCompleto = razonSocial;
    camposActualizados += 1;
  }
  for (const [campoFormulario, campoMid] of [
    ["procedencia", "ProcedenciaEmpresaId"],
    ["regimenContributivo", "RegimenContributivo"],
  ] as const) {
    const valor = enteroOpcional(formulario[campoFormulario], campoMid, 1);
    if (valor !== undefined) {
      detalle[campoMid] = valor;
      camposActualizados += 1;
    }
  }
  for (const [campoFormulario, campoMid] of [
    ["exclusividadImportacion", "ExclusividadProducto"],
    ["clasificacionPyme", "Pyme"],
    ["registroMercantilActivo", "RegistroMercantil"],
    ["sujetoRetencion", "SujetoRetencion"],
    ["agenteRetenedor", "AgenteRetenedor"],
    ["responsableIca", "ResponsableIca"],
    ["responsableIva", "ResponsableIva"],
  ] as const) {
    const valor = booleanoOpcional(formulario, campoFormulario);
    if (valor !== undefined) {
      detalle[campoMid] = valor;
      camposActualizados += 1;
    }
  }

  const descripcionPortafolioHtml = textoNullableActualizacion(
    formulario,
    "descripcionServicios",
  );
  // El editor enriquecido guarda HTML; el MID espera texto legible.
  const descripcionPortafolio = descripcionPortafolioHtml === null
    || descripcionPortafolioHtml === undefined
    ? descripcionPortafolioHtml
    : textoPlanoDesdeHtml(descripcionPortafolioHtml);
  if (descripcionPortafolio !== undefined) {
    camposActualizados += 1;
  }

  const cuentaId = cuentaConsultada
    ? idMaterializado(cuentaConsultada, "Id", "CuentaBancaria")
    : undefined;
  const cuentaBancaria: CuentaBancariaMidActualizacion = cuentaId !== undefined
    ? { Id: cuentaId }
    : {};
  const entidadBancariaId = enteroNumericoOpcional(
    formulario["banco"],
    "EntidadBancariaId",
    1,
  );
  if (entidadBancariaId !== undefined) {
    cuentaBancaria.EntidadBancariaId = entidadBancariaId;
    camposActualizados += 1;
  }
  const tipoCuentaId = enteroNumericoOpcional(
    formulario["tipoCuenta"],
    "TipoCuentaId",
    1,
  );
  if (tipoCuentaId !== undefined) {
    cuentaBancaria.TipoCuentaId = tipoCuentaId;
    camposActualizados += 1;
  }
  const numeroCuenta = textoActualizacion(formulario, "numeroCuenta");
  if (numeroCuenta !== undefined) {
    cuentaBancaria.NumeroCuenta = numeroCuenta;
    camposActualizados += 1;
  }
  const montoCapitalAutorizado = enteroOpcional(
    formulario["capitalAutorizado"],
    "MontoCapitalAutorizado",
    0,
  );
  if (montoCapitalAutorizado !== undefined) {
    cuentaBancaria.MontoCapitalAutorizado = montoCapitalAutorizado;
    camposActualizados += 1;
  }
  if (cuentaId === undefined && Object.keys(cuentaBancaria).length === 0) {
    omisiones.push(
      "CuentaBancaria omitida: el paso no contiene los campos bancarios para crearla.",
    );
  }

  const actividades = actividadesNuevas(
    formulario["actividadesCiiu"],
    datosConsultados,
  );
  if (actividades.length > 0) {
    camposActualizados += actividades.length;
  }
  if (camposActualizados === 0) {
    throw new Error(
      "No hay campos compatibles con el MID para actualizar en Persona Jurídica.",
    );
  }

  const payload: ActualizarProveedorJuridicoMidPayload = {
    Id: base.Id,
    TipoProveedor: base.TipoProveedor,
  };
  if (base.TerceroId !== undefined) {
    payload.TerceroId = base.TerceroId;
  }
  if (Object.keys(tercero).length > 0) {
    payload.Tercero = tercero;
  }
  if (Object.keys(detalle).length > 0) {
    payload.ProveedorJuridico = detalle;
  }
  if (descripcionPortafolio !== undefined) {
    payload.DescripcionPortafolio = descripcionPortafolio;
  }
  if (Object.keys(cuentaBancaria).length > (cuentaId === undefined ? 0 : 1)) {
    payload.CuentaBancaria = [cuentaBancaria];
  } else if (cuentaId !== undefined) {
    omisiones.push(
      "CuentaBancaria no modificada: no hay campos bancarios editables con valor.",
    );
  }
  if (actividades.length > 0) {
    payload.ActividadEconomicaProveedor = actividades;
  }
  omisiones.push(
    "DatosIdentificacion no se modifican en PATCH para evitar crear una identificación duplicada.",
    "TipoConformacion no se envía: el control actual describe la conformación de la cuenta bancaria, no el tipo societario.",
    "Las actividades económicas quitadas del formulario no se borran porque el contrato no ofrece una operación de eliminación.",
  );

  return {
    payload,
    omisiones,
  };
}

export function combinarProveedorMidMaterializado(
  anterior: ProveedorMidMaterializado,
  reciente: ProveedorMidMaterializado,
): ProveedorMidMaterializado {
  for (const campo of ["Id", "TerceroId", "TipoProveedor"] as const) {
    if (
      reciente[campo] !== undefined
      && anterior[campo] !== undefined
      && reciente[campo] !== anterior[campo]
    ) {
      throw new Error(
        `La respuesta PATCH devolvió un ${campo} distinto al registro consultado.`,
      );
    }
  }

  const combinado: ProveedorMidMaterializado = {
    ...anterior,
    ...reciente,
    Id: anterior.Id,
    TerceroId: anterior.TerceroId,
    TipoProveedor: anterior.TipoProveedor,
  };

  for (const rama of [
    "Tercero",
    "ProveedorNatural",
    "ProveedorJuridico",
  ] as const) {
    const nodoAnterior = registroOpcional(anterior[rama], rama);
    const nodoReciente = registroOpcional(reciente[rama], rama);
    if (nodoAnterior && nodoReciente) {
      if (
        nodoAnterior["Id"] !== undefined
        && nodoReciente["Id"] !== undefined
        && nodoAnterior["Id"] !== nodoReciente["Id"]
      ) {
        throw new Error(
          `La respuesta PATCH devolvió un Id distinto para ${rama}.`,
        );
      }
      combinado[rama] = { ...nodoAnterior, ...nodoReciente };
    } else if (nodoAnterior) {
      combinado[rama] = nodoAnterior;
    }
  }

  const tercero = registroOpcional(combinado["Tercero"], "Tercero");
  const terceroAnterior = registroOpcional(anterior["Tercero"], "Tercero");
  if (tercero && terceroAnterior) {
    if (tercero["Id"] !== terceroAnterior["Id"]) {
      throw new Error(
        "La respuesta PATCH devolvió un Id distinto para Tercero.",
      );
    }
    for (const relacion of ["DatosIdentificacion"] as const) {
      const valoresAnteriores = terceroAnterior[relacion];
      if (Array.isArray(valoresAnteriores)) {
        tercero[relacion] = valoresAnteriores;
      }
    }
    combinado["Tercero"] = tercero;
  }

  for (const relacion of [
    "Contacto",
    "CuentaBancaria",
    "ActividadEconomicaProveedor",
  ] as const) {
    const valoresAnteriores = anterior[relacion];
    if (Array.isArray(valoresAnteriores)) {
      combinado[relacion] = valoresAnteriores;
    }
  }

  return combinado;
}

export function mapearPersonaNaturalMid(
  valorFormulario: unknown,
): MapeoPayloadMid<NuevoProveedorNaturalMidPayload> {
  const formulario = registro(valorFormulario, "persona natural");
  const identificacion = registro(formulario["identificacion"], "identificación");
  const experiencia = registro(formulario["experiencia"], "experiencia");
  const tributario = registro(formulario["tributario"], "información tributaria");
  const afiliaciones = registro(
    formulario["afiliacionesFinanzas"],
    "afiliaciones y finanzas",
  );
  const actividad = registro(
    formulario["actividadDeclaracion"],
    "actividad",
  );

  const numeroDocumento = textoOpcional(identificacion, "numeroDocumento");
  const tipoDocumentoId = enteroOpcional(
    identificacion["tipoDocumento"],
    "TipoDocumentoId",
    1,
  );
  let datosDocumento: DatosIdentificacionMid | undefined;
  if (numeroDocumento) {
    datosDocumento = { Numero: numeroDocumento };
    if (tipoDocumentoId !== undefined) {
      datosDocumento.TipoDocumentoId = tipoDocumentoId;
    }
    const ciudadExpedicion = enteroOpcional(
      identificacion["ciudadExpedicion"],
      "CiudadExpedicion",
      1,
    );
    if (ciudadExpedicion !== undefined) {
      datosDocumento.CiudadExpedicion = ciudadExpedicion;
    }
    const fechaExpedicion = fechaOpcional(
      identificacion,
      "fechaExpedicion",
    );
    if (fechaExpedicion) {
      datosDocumento.FechaExpedicion = fechaExpedicion;
    }
    const digitoVerificacion = enteroOpcional(
      identificacion["dv"],
      "DigitoVerficacion",
      0,
    );
    if (digitoVerificacion !== undefined) {
      datosDocumento.DigitoVerficacion = digitoVerificacion;
    }
  }

  const primerNombre = textoOpcional(identificacion, "primerNombre");
  const segundoNombre = textoOpcional(identificacion, "segundoNombre");
  const primerApellido = textoOpcional(identificacion, "primerApellido");
  const segundoApellido = textoOpcional(identificacion, "segundoApellido");
  const tercero: TerceroMid = {};
  if (primerNombre !== undefined) {
    tercero.PrimerNombre = primerNombre;
  }
  if (primerApellido !== undefined) {
    tercero.PrimerApellido = primerApellido;
  }
  const fechaNacimiento = fechaOpcional(identificacion, "fechaNacimiento");
  if (fechaNacimiento) {
    tercero.FechaNacimiento = fechaNacimiento;
  }
  if (segundoNombre) {
    tercero.SegundoNombre = segundoNombre;
  }
  if (segundoApellido) {
    tercero.SegundoApellido = segundoApellido;
  }

  const proveedorNatural: ProveedorNaturalMid = {};
  const experienciaLaboral = enteroOpcional(
    experiencia["experienciaLaboralTotal"],
    "ExperienciaLaboral",
    0,
  );
  if (experienciaLaboral !== undefined) {
    proveedorNatural.ExperienciaLaboral = experienciaLaboral;
  }
  const experienciaProfesional = enteroOpcional(
    experiencia["experienciaProfesional"],
    "ExperienciaProfesional",
    0,
  );
  if (experienciaProfesional !== undefined) {
    proveedorNatural.ExperienciaProfesional = experienciaProfesional;
  }
  const paisNacimientoId = enteroOpcional(
    identificacion["paisNacimiento"],
    "PaisNacimientoId",
    1,
  );
  if (paisNacimientoId !== undefined) {
    proveedorNatural.PaisNacimientoId = paisNacimientoId;
  }
  for (const [campoFormulario, campoMid] of [
    ["medicinaPrepagada", "MedicinaPrepagada"],
    ["responsableIva", "ResponsableIva"],
    ["resideFiscalmenteColombia", "ResideColombia"],
    ["aportesPensionVoluntaria", "PensionVoluntaria"],
  ] as const) {
    const valor = booleanoOpcional(tributario, campoFormulario);
    if (valor !== undefined) {
      proveedorNatural[campoMid] = valor;
    }
  }
  const pensionado = booleanoOpcional(
    afiliaciones,
    "pensionadoAsignacionRetiro",
  );
  if (pensionado !== undefined) {
    proveedorNatural.Pensionado = pensionado;
  }

  const omisiones = [
    "Caracterización socio-demográfica, dirección y contactos omitidos: no tienen propiedades equivalentes en el contrato de escritura.",
    "Los montos de medicina prepagada, AFC y pensión voluntaria no se envían porque el formulario no los captura.",
    "Perfil omitido: no se confirmó que el catálogo del formulario corresponda al Perfil del MID.",
    "La actividad económica principal no se distingue: el contrato solo permite registrar los IDs de las actividades.",
    "TipoContribuyenteId omitido: no se confirmó una fuente autorizada y el formulario no recopila este identificador.",
    "Los campos de pasos posteriores no se incluyen en el POST inicial.",
  ];
  if (datosDocumento) {
    tercero.DatosIdentificacion = [datosDocumento];
  } else {
    omisiones.push(
      "DatosIdentificacion omitidos: el contrato permite omitir la relación y no se construye con una clave natural incompleta.",
    );
  }
  const payload: NuevoProveedorNaturalMidPayload = {};
  if (Object.keys(tercero).length > 0) {
    payload.Tercero = tercero;
  }
  if (Object.keys(proveedorNatural).length > 0) {
    payload.ProveedorNatural = proveedorNatural;
  }
  const actividades = actividadesNuevas(
    actividad["actividadesCiiu"],
    {},
  );
  if (actividades.length > 0) {
    payload.ActividadEconomicaProveedor = actividades;
  }
  return { payload, omisiones };
}

export function mapearPersonaJuridicaMid(
  valorFormulario: unknown,
): MapeoPayloadMid<NuevoProveedorJuridicoMidPayload> {
  const formulario = registro(valorFormulario, "persona jurídica");
  const omisiones = [
    "Datos del representante legal omitidos: no existe una relación escribible equivalente confirmada en el contrato.",
    "Dirección y contactos omitidos: no se confirmó el TipoCanalContactoId requerido para crear contactos.",
    "Calidad de gran contribuyente omitida: no tiene una propiedad equivalente en ProveedorJuridico.",
    "La actividad económica principal no se distingue: el contrato solo permite registrar los IDs de las actividades.",
    "Los campos de pasos posteriores no se incluyen en el POST inicial.",
  ];

  const tercero: TerceroMid = {};
  const razonSocial = textoOpcional(formulario, "razonSocial");
  if (razonSocial !== undefined) {
    tercero.NombreCompleto = razonSocial;
  }
  const numeroNit = textoOpcional(formulario, "nit");
  if (numeroNit) {
    const documento: DatosIdentificacionMid = { Numero: numeroNit };
    const digitoVerificacion = enteroOpcional(
      formulario["digitoVerificacion"],
      "DigitoVerficacion",
      0,
    );
    if (digitoVerificacion !== undefined) {
      documento.DigitoVerficacion = digitoVerificacion;
    }
    tercero.DatosIdentificacion = [documento];
  } else {
    omisiones.push(
      "DatosIdentificacion omitidos: el formulario no contiene un NIT válido.",
    );
  }
  const proveedorJuridico: ProveedorJuridicoMid = {};
  const procedenciaEmpresaId = enteroOpcional(
    formulario["procedencia"],
    "ProcedenciaEmpresaId",
    1,
  );
  if (procedenciaEmpresaId !== undefined) {
    proveedorJuridico.ProcedenciaEmpresaId = procedenciaEmpresaId;
  }
  const regimenContributivo = enteroOpcional(
    formulario["regimenContributivo"],
    "RegimenContributivo",
    1,
  );
  if (regimenContributivo !== undefined) {
    proveedorJuridico.RegimenContributivo = regimenContributivo;
  }
  for (const [campoFormulario, campoMid] of [
    ["exclusividadImportacion", "ExclusividadProducto"],
    ["clasificacionPyme", "Pyme"],
    ["registroMercantilActivo", "RegistroMercantil"],
    ["sujetoRetencion", "SujetoRetencion"],
    ["agenteRetenedor", "AgenteRetenedor"],
    ["responsableIca", "ResponsableIca"],
    ["responsableIva", "ResponsableIva"],
  ] as const) {
    const valor = booleanoOpcional(formulario, campoFormulario);
    if (valor !== undefined) {
      proveedorJuridico[campoMid] = valor;
    }
  }

  const payload: NuevoProveedorJuridicoMidPayload = {};
  if (Object.keys(tercero).length > 0) {
    payload.Tercero = tercero;
  }
  if (Object.keys(proveedorJuridico).length > 0) {
    payload.ProveedorJuridico = proveedorJuridico;
  }
  const actividades = actividadesNuevas(
    formulario["actividadesCiiu"],
    {},
  );
  if (actividades.length > 0) {
    payload.ActividadEconomicaProveedor = actividades;
  }

  return { payload, omisiones };
}
