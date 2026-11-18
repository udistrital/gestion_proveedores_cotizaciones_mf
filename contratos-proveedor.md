# Contratos actuales del MID de proveedores

Las rutas tienen prefijo `/v1` y reciben JSON.

## Registro

**Método y endpoint:** `POST /v1/proveedor`

**Request:** objeto JSON anidado. `TipoProveedor` es obligatorio y debe ser un entero positivo. Los demás campos y subobjetos son opcionales para las validaciones del MID. Se aceptan los campos declarados escribibles en la configuración; los campos no declarados y los `null` en campos no anulables se rechazan.

### Objeto raíz `Proveedor`

| Campo | Tipo | Condición |
|---|---|---|
| `TipoProveedor` | integer | Obligatorio, positivo. |
| `DescripcionPortafolio` | string | Opcional, admite `null`. |
| `Consentimiento` | boolean | Opcional, admite `null`. |
| `TerceroId` | integer | Opcional, admite `null`; el MID puede derivarlo de `Tercero`. |
| `UsuarioModificacionId` | integer | Opcional, admite `null`. |
| `Id` | integer | Opcional; identifica un registro existente. |

### Subobjetos

`Tercero` es opcional. Si se envía, admite `NombreCompleto`, `PrimerNombre`, `SegundoNombre`, `PrimerApellido`, `SegundoApellido`, `LugarOrigen`, `FechaNacimiento`, `TipoContribuyenteId` y `UsuarioWso2`. Puede incluir `DatosIdentificacion` con los campos `Numero`, `TipoDocumentoId`, `DigitoVerficacion`, `CiudadExpedicion`, `FechaExpedicion` y `DocumentoSoporte`.

Las ramas de detalle son opcionales, pero mutuamente excluyentes:

* **`ProveedorNatural`**: `PaisNacimientoId`, `Cargo`, `MedicinaPrepagada`, `ValorUvtPrepagada`, `InteresViviendaAfc`, `DependienteHijoMejorEdad`, `DependienteHijoMenos23Estudiando`, `DependienteHijoMas23Discapacitado`, `DependienteConyuge`, `DependientePadreOHermano`, `Pensionado`, `ValorAfc`, `ResponsableIva`, `ResideColombia`, `PensionVoluntaria`, `ValorPensionVoluntaria`, `ExperienciaLaboral`, `ExperienciaProfesional` y `UsuarioModificacionId`.
* **`ProveedorJuridico`**: `ProcedenciaEmpresaId`, `CiudadOrigenId`, `PaisOrigenId`, `CodigoPostal`, `TipoConformacionId`, `ExclusividadProducto`, `RegimenContributivo`, `Pyme`, `RegistroMercantil`, `SujetoRetencion`, `AgenteRetenedor`, `ResponsableIca`, `ResponsableIva` y `UsuarioModificacionId`.

El MID propaga el `Id` del proveedor a la rama de detalle. Los valores de catálogo se envían mediante sus IDs.

Relaciones de colección adicionales admitidas en la raíz:

| Relación | Campos escribibles de cada elemento |
|---|---|
| `ActividadEconomicaProveedor` | `ActividadEconomicaId`, `UsuarioModificacionId` |
| `Contacto` | `Id`, `NombreContacto`, `ValorEspecifico`, `TipoCanalContactoId`, `Proposito`, `Extension`, `UsuarioModificacionId` |
| `CuentaBancaria` | `Id`, `TipoCuentaId`, `NumeroCuenta`, `EntidadBancariaId`, `ContactoId`, `MontoCapitalAutorizado`, `UsuarioModificacionId` |
| `Documento` | `TipoDocumentoId`, `Enlace`, `UsuarioModificacionId` |
| `EstadoProveedor` | `EstadoId`, `Observacion`, `UsuarioModificacionId` |
| `PerfilProveedor` | `PerfilId`, `UsuarioModificacionId` |
| `Representacion` | `RepresentanteId`, `UsuarioModificacionId` |
| `TituloProveedorNatural` | `TituloObtenido`, `NucleoBasicoConocimientoSniesId`, `PerfilId`, `UsuarioModificacionId` |

Otras relaciones anidadas escribibles: `ProveedorJuridico.PersonaJuridicaTipoEntidad` (`NombrePerfilEntidad`, `TipoEntidadId`, `UsuarioModificacionId`); `Tercero.InfoComplementariaTercero` (`InfoComplementariaId`, `InfoComplementariaTerceroPadreId`, `Dato`); `Tercero.SeguridadSocialTercero` (`TerceroEntidadId`, `FechaInicioVinculacion`, `FechaFinVinculacion`).

En las tablas de configuración, los campos de negocio están marcados como no requeridos; la regla obligatoria adicional del servicio es `TipoProveedor` positivo. La omisión de una propiedad no equivale a enviar `null`. En las colecciones, `Id` identifica un elemento existente; si se omite, el MID intenta crear uno. Las llaves foráneas al proveedor o al tercero se propagan cuando corresponde.

### Registro parcial

El cuerpo mínimo aceptado por el MID para ambos tipos contiene solo `TipoProveedor`. No es obligatorio enviar `Tercero` ni el detalle correspondiente.

Persona natural (el valor debe ser el ID de `P_NATURAL` del entorno):

```json
{
  "TipoProveedor": 1
}
```

Persona jurídica (el valor debe ser positivo y distinto del ID de `P_NATURAL`; `2` es solo ilustrativo):

```json
{
  "TipoProveedor": 2
}
```

### Respuesta de registro

El envelope contiene `Success`, `Status`, `Message` y `Data`. `Data` devuelve el árbol recibido enriquecido con IDs materializados y llaves propagadas.

```json
{
  "Success": true,
  "Status": "200",
  "Message": "Proveedor registrado correctamente",
  "Data": {
    "Id": 10,
    "TipoProveedor": 1
  }
}
```

Cuando la operación tiene avisos, responde `206` y agrega `MetaData.Errors`.

## Actualización

**Método y endpoint:** `PATCH /v1/proveedor`

**Request:** la misma estructura y campos aceptados que el registro. `TipoProveedor` sigue siendo obligatorio y positivo. El `Id` identifica la entidad raíz; si no se envía, el MID intenta localizarla por la clave natural configurada (`TerceroId`) y, si no encuentra registro, intenta crearla. En subobjetos, `Id` identifica el registro correspondiente.

Se procesan los campos y nodos presentes en el cuerpo. Los elementos de colección con `Id` se reconcilian como existentes; sin `Id` se intenta crear un elemento. La respuesta usa el mismo envelope que el registro; el mensaje de éxito actual también es `Proveedor registrado correctamente`.

## Consulta individual

**Método y endpoint:** `POST /v1/proveedor/consulta`

**Request:**

```json
{
  "id": 12,
  "fields": [
    "Id",
    "Tercero.NombreCompleto",
    "Tercero.DatosIdentificacion.Numero",
    "ProveedorNatural.PaisNacimientoId"
  ]
}
```

`id` es obligatorio y debe ser un entero positivo. `fields` es opcional; si se envía, contiene rutas configuradas, canónicas, no vacías y no duplicadas. Sin `fields`, se solicita la expansión completa configurada. La rama de detalle de la respuesta corresponde al `TipoProveedor` del registro.

`Data` contiene la raíz (`Id`, `TerceroId`, `TipoProveedor`, `Activo`) y las relaciones expandidas. Sin avisos responde `200`; con avisos de expansión responde `206` y agrega `MetaData.Errors`. También están contemplados `400` (request inválido), `404` (proveedor inexistente), `405` (método no permitido), `502` (error de dependencia) y `504` (timeout).

## Consulta de lista

**Método y endpoint:** `POST /v1/proveedor/consulta/lista`

**Request:**

```json
{
  "query": ["TipoProveedor:1", "TerceroId:25"],
  "fields": ["Id", "Tercero.NombreCompleto"],
  "limit": 20,
  "offset": 0
}
```

Todos los campos son opcionales. `query` contiene condiciones `Campo[__operador]:valor` combinadas con AND, sobre campos filtrables de primer nivel: `Id`, `TipoProveedor`, `DescripcionPortafolio`, `Consentimiento`, `TerceroId`, `Activo`, `FechaCreacion`, `FechaModificacion` y `UsuarioModificacionId`. Operadores permitidos: `exact`, `iexact`, `contains`, `icontains`, `gt`, `gte`, `lt`, `lte`, `startswith`, `istartswith`, `endswith`, `iendswith`, `in` e `isnull`; `in` recibe valores separados por `|`.

`fields` selecciona las rutas a expandir; si se omite, el listado no expande relaciones. `limit` vale 20 por defecto, máximo 100; `0` aplica el valor por defecto. `offset` vale 0 por defecto.

La respuesta contiene `Data` como arreglo y `MetaData.Total`; `MetaData.Errors` se agrega si hay avisos. Los estados de éxito son `200` y `206`; también contempla `400`, `405`, `502` y `504`.

## Códigos y envelope de respuesta

| HTTP | Uso |
|---|---|
| `200` | Operación completada sin avisos. |
| `206` | Operación con avisos; incluye `MetaData.Errors`. |
| `400` | Request o campos inválidos. |
| `404` | Proveedor no encontrado en consulta individual. |
| `405` | Método HTTP no admitido. |
| `502` | Error de dependencia/CRUD. |
| `504` | Timeout de dependencia/CRUD. |

El envelope contiene `Success` (boolean), `Status` (string), `Message` (string) y `Data`. `MetaData` es opcional; puede contener `Errors` y, para listas, `Total`.

## Referencias de implementación

* Rutas: [main.go](../main.go#L71), [main.go](../main.go#L79), [main.go](../main.go#L88).
* Handlers: [controllers/proveedor.go](../controllers/proveedor.go#L95), [controllers/proveedor.go](../controllers/proveedor.go#L155), [controllers/proveedor.go](../controllers/proveedor.go#L269).
* Escritura y tipo de proveedor: [services/proveedor_write.go](../services/proveedor_write.go#L73), [main.go](../main.go#L42).
* Consulta y listado: [services/proveedor.go](../services/proveedor.go#L86), [services/proveedor.go](../services/proveedor.go#L136).
* Campos de proveedor y relaciones: [objetos_proveedor.yaml](../config/gestion_personas_crud/objetos_proveedor.yaml#L2), [relaciones_proveedor.yaml](../config/gestion_personas_crud/relaciones_proveedor.yaml#L2), [objetos_proveedor_natural.yaml](../config/gestion_personas_crud/objetos_proveedor_natural.yaml#L2), [objetos_proveedor_juridico.yaml](../config/gestion_personas_crud/objetos_proveedor_juridico.yaml#L2).
* Campos de subobjetos: [objetos_tercero.yaml](../config/terceros/objetos_tercero.yaml#L2), [objetos_datos_identificacion.yaml](../config/terceros/objetos_datos_identificacion.yaml#L2), [objetos_contacto.yaml](../config/gestion_personas_crud/objetos_contacto.yaml#L2), [objetos_cuenta_bancaria.yaml](../config/gestion_personas_crud/objetos_cuenta_bancaria.yaml#L2).
* Envelope: [response.go](../responses/response.go#L1).
