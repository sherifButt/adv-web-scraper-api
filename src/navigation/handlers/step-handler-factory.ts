import { Page } from 'playwright';
import { IStepHandler } from '../types/step-handler.interface.js';
import { GotoStepHandler } from './goto-step-handler.js';
import { ClickStepHandler } from './click-step-handler.js';
import { InputStepHandler } from './input-step-handler.js';
import { SelectStepHandler } from './select-step-handler.js';
import { WaitStepHandler } from './wait-step-handler.js';
import { ExtractStepHandler } from './extract-step-handler.js';
import { ConditionStepHandler } from './condition-step-handler.js';
import { ScrollStepHandler } from './scroll-step-handler.js';
import { MouseStepHandler } from './mouse-step-handler.js';
import { HoverStepHandler } from './hover-step-handler.js';
import { ScriptStepHandler } from './script-step-handler.js';
import { PaginateStepHandler } from './paginate-step-handler.js';
import { ForEachElementStepHandler } from './for-each-element-step-handler.js';
import { MergeContextStepHandler } from './merge-context-step-handler.js'; // Import the new handler
import { BehaviorEmulator } from '../../core/human/behavior-emulator.js';
import { NavigationContext } from '../types/navigation.types.js'; // Import NavigationContext

export class StepHandlerFactory {
  private handlers: IStepHandler[];

  constructor(page: Page) {
    const behaviorEmulator = new BehaviorEmulator(page);
    this.handlers = [
      new GotoStepHandler(), // Instantiate GotoStepHandler (doesn't need page)
      new ClickStepHandler(page),
      new InputStepHandler(page),
      new SelectStepHandler(page),
      new WaitStepHandler(page),
      new ExtractStepHandler(page),
      new ConditionStepHandler(page, this), // Pass factory instance
      new ScrollStepHandler(page),
      new MouseStepHandler(page),
      new HoverStepHandler(page),
      new ScriptStepHandler(page),
      new PaginateStepHandler(page, this),
      new ForEachElementStepHandler(), // Note: ForEachElement might need the factory if it executes nested steps
      new MergeContextStepHandler(page), // Add the new handler instance
    ];
  }

  public getHandler(stepType: string): IStepHandler {
    const handler = this.handlers.find(h => h.canHandle({ type: stepType } as any));
    if (!handler) {
      throw new Error(`No handler found for step type: ${stepType}`);
    }
    return handler;
  }

  public addHandler(handler: IStepHandler): void {
    this.handlers.push(handler);
  }
}
