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
import { MergeContextStepHandler } from './merge-context-step-handler.js';
import { AssertStepHandler } from './assert-step-handler.js';
import { LoginStepHandler } from './login-step-handler.js';
import { SwitchToFrameStepHandler } from './switch-to-frame-step-handler.js';
import { UploadFileStepHandler } from './upload-file-step-handler.js';
import { HandleDialogStepHandler } from './handle-dialog-step-handler.js';
import { ManageCookiesStepHandler } from './manage-cookies-step-handler.js';
import { ManageStorageStepHandler } from './manage-storage-step-handler.js';
import { SwitchTabStepHandler } from './switch-tab-step-handler.js';
import { PressStepHandler } from './press-step-handler.js'; // Import the new handler
// Removed unused BehaviorEmulator import
import { NavigationContext } from '../types/navigation.types.js'; // Import NavigationContext

export class StepHandlerFactory {
  private handlers: IStepHandler[];

  constructor(page: Page) {
    // Removed unused behaviorEmulator instantiation
    this.handlers = [
      new GotoStepHandler(page), // Pass page to constructor
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
      new MergeContextStepHandler(page),
      new AssertStepHandler(page),
      new LoginStepHandler(page),
      new SwitchToFrameStepHandler(page, this),
      new UploadFileStepHandler(page),
      new HandleDialogStepHandler(page),
      new ManageCookiesStepHandler(page),
      new ManageStorageStepHandler(page),
      new SwitchTabStepHandler(page),
      new PressStepHandler(page), // Add the PressStep handler instance
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
