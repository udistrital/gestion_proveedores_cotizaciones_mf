import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoConfirmarDecisionComponent } from "./dialogo-confirmar-decision/dialogo-confirmar-decision.component";
import { FichaDecisionModificacionComponent } from "./ficha-decision-modificacion/ficha-decision-modificacion.component";
import { FichaDecisionComponent } from "./ficha-decision/ficha-decision.component";
import { ResolucionModificacionComponent } from "./resolucion-modificacion/resolucion-modificacion.component";

/**
 * Componentes compartidos del trámite de decisión.
 *
 * `FichaDecisionComponent` lo usan S-11 (envío), O-03 (validación final) y
 * O-02 (lectura). `FichaDecisionModificacionComponent` es su hermano para O-04
 * (la decisión es sobre una modificación, no sobre una oferta) y comparte el
 * diálogo de confirmación. Viven en `cotizaciones/components` porque dependen
 * del modelo del módulo, no del catálogo genérico de `shared`.
 */
@NgModule({
  declarations: [
    FichaDecisionComponent,
    FichaDecisionModificacionComponent,
    ResolucionModificacionComponent,
    DialogoConfirmarDecisionComponent,
  ],
  imports: [CommonModule, SharedModule],
  exports: [
    FichaDecisionComponent,
    FichaDecisionModificacionComponent,
    ResolucionModificacionComponent,
    DialogoConfirmarDecisionComponent,
  ],
})
export class DecisionModule {}
