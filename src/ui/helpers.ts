//!strict

import type { UiComponentFuncs } from "./components";

import { GuiService, ReplicatedStorage, UserInputService, Workspace } from "@rbxts/services";
import type { UiElement } from "./uiController";
import { tickManager } from "../system/tickManager";
import { GenericError, type GenericEvent, type GenericEventCaller, type ValueOf, createEvent } from "../utils";
import { clientTasks, type ViewportSizePromiseTaskArgs } from "../res/definitions";
import type { StateArgs, States } from "../system/stateController";

const uiElementsFolder = ReplicatedStorage.FindFirstChild("res")?.FindFirstChild("ui")?.FindFirstChild("elements") as Folder;

/**
 * Selection template
 */
const selectionTemplate: Folder = uiElementsFolder.FindFirstChild("selection") as Folder;

/**
 * Frame template
 */
const frameTemplate: Folder = uiElementsFolder.FindFirstChild("frame") as Folder;

/**
 * Label template
 */
const labelTemplate: Folder = uiElementsFolder.FindFirstChild("label") as Folder;

/**
 * Ui element templates type
 */
interface UiElementTemplates {
	/**
	 * Ui element template
	 *
	 * @readonly
	 */
	readonly [key: string]: Folder
}

/**
 * Fires when screen size changes
 *
 * @extends {GenericEvent<[]>}
 */
interface ScreenSizeChangedEvent extends GenericEvent<[]> { }
/**
 * Caller that fires when screen size changes
 *
 * @extends {GenericEventCaller<[]>}
 */
interface ScreenSizeChangedEventCaller extends GenericEventCaller<[]> { }

/**
 * Ui initializer
 */
class UiInitializer {
	/**
	 * Current viewport size
	 *
	 * @public
	 */
	public screenSize: Vector2 | undefined;
	/**
	 * Screen size change event
	 *
	 * @public
	 * @readonly
	 */
	public readonly screenSizeChanged: ScreenSizeChangedEvent;
	/**
	 * Hidden screen size change event caller
	 *
	 * @public
	 * @readonly
	 */
	public readonly screenSizeChangedCaller: ScreenSizeChangedEventCaller;

	/**
	 * Creates an instance of UiInitializer
	 *
	 * @constructor
	 * @public
	 */
	public constructor() {
		[this.screenSizeChanged, this.screenSizeChangedCaller] = createEvent() as [ScreenSizeChangedEvent, ScreenSizeChangedEventCaller];
	}

	/**
	 * Enables screen size updating
	 *
	 * @public
	 */
	public init(): Promise<void> {
		const camera = Workspace.CurrentCamera as Camera;

		const screenSizeChangeCallback = (): void => {
			this.screenSize = camera.ViewportSize;

			this.screenSizeChangedCaller.fire();
		}

		camera.GetPropertyChangedSignal("ViewportSize").Connect(() => screenSizeChangeCallback());

		const fun = clientTasks.viewportSizePromise;

		const viewportSizeWaitService = tickManager.createService({
			task: fun,
			threadSafe: true,
			args: {
				camera,
				screenSizeChangeCallback
			} as ViewportSizePromiseTaskArgs
		});

		UserInputService.InputBegan.Connect((input) => {
			if (input.KeyCode === Enum.KeyCode.F11) {
				screenSizeChangeCallback();
			}
		});

		return new Promise((resolve) => {
			const event = fun.event?.Event.Connect(() => {
				event?.Disconnect();

				tickManager.removeService(viewportSizeWaitService);

				screenSizeChangeCallback();

				resolve();
			});
		});
	}

	/**
	 * Checks if the ui is initialized
	 *
	 * @public
	 * @returns {boolean} Is the ui initialized
	 */
	public isUiInitialized(): boolean {
		return this.screenSize !== undefined;
	}
}

interface InputData {
	readonly type: keyof InputBindings;
	readonly modifiers: InputModifiersState;
}

/**
 * Plane with cool name
 *
 * @export
 */
export interface UiSelectionBox {
	/**
	 * Start corner
	 *
	 * @public
	 * @readonly
	 */
	readonly startCorner: Vector2;
	/**
	 * End corner
	 *
	 * @public
	 * @readonly
	 */
	readonly endCorner: Vector2;
}

/**
 * Adds roblox gui offset to the given position
 *
 * @export
 * @param {Vector2} vector Position to be corrected
 * @param {boolean} [outsideOfUi=false] Is the position a scalar
 * @returns {Vector2} Corrected position
 */
export function addGuiInsetOffset(vector: Vector2, outsideOfUi: boolean = false): Vector2 {
	if (!outsideOfUi) {
		return vector.add(absoluteToRelativeVector2(GuiService.GetGuiInset()[0]));
	}

	return vector.add(GuiService.GetGuiInset()[0]);
}

/**
 * Converts absolute vector2 to relative
 *
 * @export
 * @param {Vector2} value Absolute vector2
 * @returns {Vector2} Relative vector2
 */
export function absoluteToRelativeVector2(value: Vector2): Vector2 {
	if (uiInitializer.isUiInitialized()) {
		return new Vector2(value.X / (uiInitializer.screenSize as Vector2).X, value.Y / (uiInitializer.screenSize as Vector2).Y);
	}

	throw new UiNotInitializedError();
}

/**
	 * Converts udim2 to vector2 in relative coords
	 *
	 * @public
	 * @param {UDim2} udim The udim2 value to be converted
	 * @returns {Vector2} Vector2 relative to the given udim2 value
	 */
export function udim2ToVector2(udim: UDim2): Vector2 {
	if (!uiInitializer.isUiInitialized()) {
		throw new UiNotInitializedError();
	}

	const normalized = absoluteToRelativeVector2(new Vector2(udim.Width.Offset, udim.Height.Offset));

	return new Vector2(udim.Width.Scale + normalized.X, udim.Height.Scale + normalized.Y);
}

/**
 * Ui initializer singleton
 */
export const uiInitializer: UiInitializer = new UiInitializer();

/**
 * Thrown when uiController has been used before creation
 *
 * @export
 * @extends {GenericError}
 */
export class UiNotInitializedError extends GenericError {
	/**
	 * Creates an instance of UiNotInitializedError
	 *
	 * @constructor
	 * @public
	 * @param {?string} [message] Custom error message
	 * @param {?UiElement} [source] Culprit element
	 */
	public constructor(message?: string, source?: UiElement) {
		const name = "UiNotInitializedError";

		if (source !== undefined) {
			super(name, message ?? `Element ${source.getInstance().Name} has been used before ui initialization.`);
			return;
		}

		super(name, message ?? "Ui has been used before initialization.");
	}
}

/**
 * Thrown when an element has been used before initialization
 *
 * @export
 * @extends {GenericError}
 */
export class UiElementNotInitializedError extends GenericError {
	/**
	 * Creates an instance of UiElementNotInitializedError
	 *
	 * @constructor
	 * @public
	 * @param {?string} [message] Custom error message
	 * @param {?UiElement} [source] Culprit element
	 */
	public constructor(message?: string, source?: UiElement) {
		const name = "UiNotInitializedError";

		if (source !== undefined) {
			super(name, message ?? `Element ${source.getInstance().Name} has been used before initializing`);
			return;
		}

		super(name, message ?? "Ui element has been used before initialization.");
	}
}

/**
 * Thrown when there is an unknown component passed when trying to add a component to an element
 *
 * @export
 * @extends {GenericError}
 */
export class UnknownUiComponentError extends GenericError {
	/**
	 * Creates an instance of UnknownUiComponentError
	 *
	 * @constructor
	 * @public
	 * @param {?string} [message] Custom error message
	 * @param {?UiElement} [source] Culprit element
	 */
	public constructor(message?: string, source?: UiElement) {
		const name = "UnknownUiComponentError";

		if (source !== undefined) {
			super(name, message ?? `Unknown ui component passed to element ${source.getInstance().Name}`);
			return;
		}

		super(name, message ?? "Unknown ui component is passed to an unknown element");
	}
}

/**
 * Thrown when a missing dependency being called in a dependent component
 *
 * @export
 * @extends {GenericError}
 */
export class UiComponentLacksDependency extends GenericError {
	/**
	 * Creates an instance of UiComponentLacksDependency
	 *
	 * @constructor
	 * @public
	 * @param {?string} [message] Custom error message
	 * @param {?UiElement} [source] Culprit element
	 * @param {?keyof UiComponentFuncs} [component] Component that lacks its dependencies
	 */
	public constructor(message?: string, source?: UiElement, component?: keyof UiComponentFuncs<StateArgs>) {
		const name = "UiComponentLacksDependency";

		if (source !== undefined && component !== undefined) {
			super(name, message ?? `Component ${component} has been used without its dependencies in element ${source.getInstance().Name}`);
			return;
		}

		if (component !== undefined) {
			super(name, message ?? `Component ${component} has been used without its dependencies in an unknown element`);
			return;
		}

		if (source !== undefined) {
			super(name, message ?? `Unknown component has been used without its dependencies in element ${source.getInstance().Name}`);
			return;
		}

		super(name, message ?? "Unknown component has been used without its dependencies in an unknown element");
	}
}

/**
 * Thrown when any argument in an ui function is invalid
 *
 * @export
 * @extends {GenericError}
 */
export class InvalidUiConstraintArgumentsError extends GenericError {
	/**
	 * Creates an instance of InvalidUiConstraintsArgumentsError
	 *
	 * @constructor
	 * @public
	 * @param {(Vector2 | number)} positionOrX Vector itself or x axis of the vector
	 * @param {?number} [y] Y axis of the vector
	 * @param {?string} [message] Custom error message
	 */
	public constructor(positionOrX: Vector2 | number, y?: number, message?: string) {
		const name = "InvalidUiConstraintsArgumentsError";

		super(name, message ?? `Constraints ${positionOrX}, ${y} are invalid!`);
	}
}

export interface InputBindings {
	readonly main: Enum.UserInputType[];
	readonly secondary: Enum.UserInputType[];
	readonly drag: Enum.UserInputType[];
}

export interface InputModifiers {
	readonly ctrl: (() => void) | undefined;
	readonly shift: (() => void) | undefined;
	readonly alt: (() => void) | undefined;
}

export interface InputModifiersState {
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
}

/**
 * Generic input event
 *
 * @export
 * @extends {GenericEvent<[InputObject, InputData]>}
 */
export interface GenericInputEvent extends GenericEvent<[InputObject, InputData]> { }
/**
 * Generic input event caller
 *
 * @export
 * @extends {GenericEventCaller<[InputObject, InputData]>}
 */
export interface GenericInputEventCaller extends GenericEventCaller<[InputObject, InputData]> { }

/**
 * Drag selection event
 *
 * @export
 * @extends {GenericEvent<[UiSelectionBox]>}
 */
export interface DragSelectionInputEvent extends GenericEvent<[UiSelectionBox]> { }
/**
 * Drag selection event caller
 *
 * @export
 * @extends {GenericEventCaller<[UiSelectionBox]>}
 */
export interface DragSelectionInputEventCaller extends GenericEventCaller<[UiSelectionBox]> { }

/**
 * Toggle event
 *
 * @export
 * @extends {GenericEvent<[boolean]>}
 */
export interface ToggleEvent extends GenericEvent<[boolean]> { }
/**
 * Toggle event caller
 *
 * @export
 * @extends {GenericEventCaller<[boolean]>}
 */
export interface ToggleEventCaller extends GenericEventCaller<[boolean]> { }

/**
 * Fires when an element is about to be removed
 *
 * @extends {GenericEvent<[]>}
 */
export interface OnRemoveEvent extends GenericEvent<[]> { }
/**
 * Caller that fires when an element is about to be removed
 *
 * @extends {GenericEventCaller<[]>}
 */
export interface OnRemoveEventCaller extends GenericEventCaller<[]> { }

export const uiElementTemplates: UiElementTemplates = {
	selection: selectionTemplate,
	frame: frameTemplate,
	label: labelTemplate
} as const;

export const uiButtonStates: States<ButtonStateArgs> = {
	default: {
		transitions: new ReadonlyMap<string, (args: ButtonStateArgs) => boolean>([
			["hovered", (args: ButtonStateArgs): boolean => args.hovered && !args.pressed]
		])
	},
	hovered: {
		transitions: new ReadonlyMap<string, (args: ButtonStateArgs) => boolean>([
			["hoveredAndPressed", (args: ButtonStateArgs): boolean => args.hovered && args.pressed],
			["default", (args: ButtonStateArgs): boolean => !args.hovered]
		])
	},
	pressed: {
		transitions: new ReadonlyMap<string, (args: ButtonStateArgs) => boolean>([
			["hoveredAndPressed", (args: ButtonStateArgs): boolean => args.hovered && args.pressed],
			["default", (args: ButtonStateArgs): boolean => !(args.hovered || args.pressed)]
		])
	},
	hoveredAndPressed: {
		transitions: new ReadonlyMap<string, (args: ButtonStateArgs) => boolean>([
			["pressed", (args: ButtonStateArgs): boolean => !args.hovered && args.pressed],
			["hovered", (args: ButtonStateArgs): boolean => args.hovered && !args.pressed]
		])
	}
} as const;

export type UiButtonState = ValueOf<typeof uiButtonStates>;

export interface ButtonStateArgs extends StateArgs {
	readonly hovered: boolean;
	readonly pressed: boolean;
}
