import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogoConfirmarDecisionComponent } from "./dialogo-confirmar-decision/dialogo-confirmar-decision.component";
import { FichaDecisionComponent } from "./ficha-decision/ficha-decision.component";

/**
 * Componentes compartidos del trámite de decisión.
 *
 * `FichaDecisionComponent` lo usan S-11 (envío), O-03 (validación final) y
 * O-02 (lectura). El diálogo de confirmación también es único para los dos
 * actos. Vive en `cotizaciones/components` porque depende del modelo del
 * módulo, no del catálogo genérico de `shared`.
 */
@NgModule({
  declarations: [FichaDecisionComponent, DialogoConfirmarDecisionComponent],
  imports: [CommonModule, SharedModule],
  exports: [FichaDecisionComponent, DialogoConfirmarDecisionComponent],
})
export class DecisionModule {}
