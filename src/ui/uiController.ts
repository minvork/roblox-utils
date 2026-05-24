//!strict

import type { StateArgs } from "../system/stateController";
import { createEvent, getKeyByValue, pointRectangleIntersection, vector2Zero } from "../utils";
import type { UiComponent, UiComponentFunc, UiComponentFuncs } from "./components";

import { uiButtonStyles, uiComponents, type UiTransform } from "./components";
import { UiNotInitializedError, uiInitializer, UiElementNotInitializedError, absoluteToRelativeVector2, addGuiInsetOffset, UnknownUiComponentError, type OnRemoveEvent, type OnRemoveEventCaller, type UiSelectionBox, type DragSelectionInputEvent, type DragSelectionInputEventCaller, UiComponentLacksDependency, type ToggleEventCaller, type ToggleEvent, uiButtonStates } from "./helpers";

/** List of objects with component fields */
type UiComponentList = {
	readonly [K in keyof UiComponentFuncs<StateArgs>]: ReturnType<UiComponentFuncs<StateArgs>[K]> | undefined;
}

/**
 * Controller for an instance of template
 */
class UiElement {
	/**
	 * Replicated element
	 *
	 * @protected
	 * @readonly
	 */
	protected readonly template: Folder;
	/**
	 * Element instance
	 *
	 * @protected
	 * @readonly
	 */
	protected readonly instance: Folder;
	/**
	 * Parent of the element
	 *
	 * No parent = ignored / invisible element (idk how is it works in roblox but maybe true)
	 *
	 * @protected
	 */
	protected parent: UiElement | undefined;
	/**
	 * Instance screen
	 *
	 * @protected
	 */
	protected screen: UiScreen | undefined;
	/**
	 * Components of the element (utilities)
	 *
	 * @public
	 * @readonly
	 */
	public readonly components: UiComponentList = {} as UiComponentList;
	/**
	 * Element remove event
	 * @readonly
	 */
	public readonly onRemove: OnRemoveEvent;
	/**
	 * Element remove event caller
	 * @readonly
	 */
	protected readonly onRemoveCaller: OnRemoveEventCaller;

	/**
	 * Creates an instance of UiElement
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template
	 * @param {?UiElement} [parent] Initial element parent
	 */
	public constructor(template: Folder, parent?: UiElement) {
		this.template = template;
		this.instance = template.Clone();
		this.parent = parent;

		[this.onRemove, this.onRemoveCaller] = createEvent() as [OnRemoveEvent, OnRemoveEventCaller];
	}

	/**
	 * Adds the component to the element
	 *
	 * @public
	 * @param {UiComponentFunc<UiComponent>} func Component to add
	 * @param {boolean} [addDependencies=true] Should the dependencies of the component be added too
	 */
	public addComponent(func: UiComponentFunc<UiComponent>, addDependencies: boolean = true): void {
		const key = getKeyByValue(uiComponents, func);

		if (key !== undefined) {
			const component = func(this);

			if (addDependencies) {
				this.addComponents(component.dependencies);
			}

			if (this.components[key] === undefined) {
				(this.components[key] as unknown as typeof component) = component;
			}

			return;
		}

		throw new UnknownUiComponentError(undefined, this);
	}

	/**
	 * Adds all the given components
	 *
	 * @private
	 * @param {UiComponentFunc<UiComponent>[]} components Components to add
	 * @param {boolean} [addDependencies=true] Should the dependencies of the components be added too
	 */
	private addComponents(components: UiComponentFunc<UiComponent>[], addDependencies: boolean = true): void {
		for (const component of components) {
			this.addComponent(component, addDependencies);
		}
	}

	/**
	 * Remove the element
	 *
	 * @public
	 */
	public remove(): void {
		this.onRemoveCaller.fire();

		this.instance.Destroy();

		for (const child of this.getChildren()) {
			child.remove();
		}
	}

	/**
	 * Get children of the element
	 *
	 * @public
	 * @returns {UiElement[]} Children of the given element
	 */
	public getChildren(): UiElement[] {
		if (this.screen) {
			const output: UiElement[] = [];

			for (const element of this.screen.getElements()) {
				if (element.getParent() === this) {
					output.push(element);
				}
			}

			return output;
		}

		throw new UiElementNotInitializedError(undefined, this);
	}

	/**
	 * Returns the element template
	 *
	 * Clone because i don't want to touch the original
	 *
	 * @public
	 * @returns {Folder} Template of the element
	 */
	public getTemplate(): Folder {
		return this.template.Clone();
	}

	/**
	 * Returns the element instance
	 *
	 * @public
	 * @returns {Folder} Instance of the element
	 */
	public getInstance(): Folder {
		return this.instance;
	}

	/**
	 * Changes the element's parent
	 *
	 * Not a variable because some things may happen while parent is changing (e.g. animation)
	 *
	 * Questionable method because the idea of this uiController was in static declaration not dynamic (aka reserve method just in case)
	 * @public
	 * @param {UiElement} parent New parent
	 */
	public changeParent(parent: UiElement): void {
		this.parent = parent;

		this.screen?.updateElements();
	}

	/**
	 * Returns the element's parent
	 *
	 * @public
	 * @returns {(UiElement | undefined)} Parent of the element
	 */
	public getParent(): UiElement | undefined {
		return this.parent;
	}

	/**
	 * Sets the screen of element
	 *
	 * Element movement between screens isn't planned but not forbidden
	 * @public
	 * @param {UiScreen} screen The screen to be set
	 */
	public setScreen(screen: UiScreen): void {
		this.screen = screen;
	}

	/**
	 * Returns the screen where the element is located
	 *
	 * @public
	 * @returns {(UiScreen | undefined)} Sscreen where the element is located
	 */
	public getScreen(): UiScreen | undefined {
		return this.screen;
	}
}

/**
 * Screens controller
 *
 * @export
 */
class UiController {
	/**
	 * Rendered screens array
	 *
	 * @private
	 * @readonly
	 */
	private readonly screens: Set<UiScreen> = new Set();
	/**
	 * Playergui instance for all screens
	 *
	 * @private
	 */
	private gui: PlayerGui | undefined;

	/**
	 * Initializes screen size change event listener hence the ui controller
	 *
	 * @public
	 * @param {PlayerGui} gui The PlayerGui instance
	 */
	public init(gui: PlayerGui): void {
		this.gui = gui;

		this.resizeController();

		uiInitializer.screenSizeChanged.subscribe(() => this.resizeController());
	}

	/**
	 * Handles resize for the whole scene
	 *
	 * @public
	 */
	public resizeController(): void {
		this.updateScreens();
	}

	/**
	 * Loads and renders the given screen
	 *
	 * @public
	 * @param {UiScreen} screen The screen to load
	 */
	public appendScreen(screen: UiScreen): void {
		this.screens.add(screen);
		this.updateScreens();
	}

	/**
	 * Unloads and removes the given screen
	 *
	 * @public
	 * @param {UiScreen} screen The screen to unload
	 */
	public removeScreen(screen: UiScreen): void {
		screen.removeAllElements();
		this.screens.delete(screen);

		this.updateScreens();
	}

	/**
	 * Puts loaded screens into the PlayerGui
	 *
	 * @private
	 */
	private updateScreens(): void {
		this.clearScreens();

		if (this.screens.size() === 0) {
			return;
		}

		for (const element of this.screens) {
			const instance: ScreenGui = element.getWindow();

			instance.Parent = this.gui;

			element.updateElements();
		}
	}

	/**
	 * Removes all screens within the PlayerGui
	 *
	 * @private
	 */
	private clearScreens(): void {
		if (this.gui) {
			for (const element of this.gui.GetChildren()) {
				const screen: UiScreen | undefined = this.findScreenByInstance(element);

				if (!screen?.alwaysRender) {
					element.Parent = undefined;
				}
			}

			return;
		}

		throw new UiNotInitializedError();
	}

	/**
	 * Finds the screen by its instance
	 *
	 * @private
	 * @param {Instance} instance The instance that will be used for searching
	 * @returns {(UiScreen | undefined)} Found screen
	 */
	private findScreenByInstance(instance: Instance): UiScreen | undefined {
		for (const element of this.screens) {
			const window: ScreenGui = element.getWindow();

			if (instance === window) {
				return element;
			}
		}
	}

	/**
	 * Gets all elements under the given position
	 *
	 * @public
	 * @param {Vector2} position Position to use
	 * @returns {UiElement[]} Elements under the given position
	 */
	public getHoveredElements(position: Vector2): UiElement[] {
		const elements: UiElement[] = [];

		for (const screen of this.screens) {
			const screenElements = screen.getHoveredElements(addGuiInsetOffset(absoluteToRelativeVector2(position)));
			for (const element of screenElements) {
				elements.push(element);
			}
		}

		return elements;
	}
}

/**
 * Basic frame class
 *
 * Assumes that there is a frame in its template (i think it's unnecessary to standardize)
 *
 * @export
 * @extends {UiElement}
 */
class UiPanel extends UiElement {
	/**
	 * Creates an instance of UiPanel
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template to be used in creation
	 * @param {?UiElement} [parent] Initial element parent
	 */
	public constructor(template: Folder, parent?: UiElement) {
		super(template, parent);

		this.addComponent(uiComponents.transform);
		this.addComponent(uiComponents.style);
	}
}

/**
 * Basic input panel with button behavior
 *
 * Assumes that there is a frame in its template (i think it's unnecessary to standardize)
 *
 * @export
 * @extends {UiPanel}
 */
class UiInputPanel extends UiPanel {
	/**
	 * Creates an instance of UiInputPanel
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template to be used in creation
	 */
	public constructor(template: Folder) {
		super(template);

		this.addComponent(uiComponents.input);
	}
}

export type { UiElement };

/**
 * Ui controller singleton
 */
export const uiController: UiController = new UiController();

/**
 * Controller for elements - "screen"
 *
 * @export
 */
export class UiScreen {
	/**
	 * Loaded (not necessarily visible) elements
	 *
	 * @private
	 */
	private elements: UiElement[] = [];
	/**
	 * Main "frame"
	 *
	 * @private
	 * @readonly
	 */
	private readonly window: ScreenGui;
	/**
	 * Can this screen be rendered together with other screens
	 *
	 * @public
	 */
	public alwaysRender: boolean;

	/**
	 * Creates an instance of UiScreen
	 *
	 * @constructor
	 * @public
	 * @param {?string} [name] Ui screen name for some reason
	 * @param {?boolean} [alwaysRender] Will the screen be always visible
	 */
	public constructor(name?: string, alwaysRender?: boolean) {
		this.window = new Instance("ScreenGui");
		this.alwaysRender = alwaysRender ?? false;

		this.window.Name = name ?? "newWindow"; /* because why not? */

		// now it is truly main frame
		this.window.IgnoreGuiInset = true;
		this.window.ScreenInsets = Enum.ScreenInsets.None;
		this.window.ResetOnSpawn = false;
	}

	/**
	 * Loads the given element
	 *
	 * @public
	 * @param {UiElement} instance Element to be loaded
	 */
	public addElement(instance: UiElement): void {
		this.elements.push(instance);
		instance.setScreen(this);

		this.updateElements();
	}

	/**
	 * Removes the given element
	 *
	 * @public
	 * @param {UiElement} instance Element to be removed
	 */
	public removeElement(instance: UiElement): void {
		const foundElement = this.elements.indexOf(instance);

		if (foundElement === -1) {
			return;
		}

		this.elements.remove(foundElement);
		instance.remove();

		this.updateElements();
	}

	/**
	 * Removes all elements of the screen
	 *
	 * @public
	 */
	public removeAllElements(): void {
		for (const element of this.elements) {
			element.remove();
		}

		this.elements = [];

		this.updateElements();
	}

	/**
	 * Loads elementS
	 *
	 * @public
	 * @param {UiElement[]} instances Elements to be loaded
	 */
	public addElements(instances: UiElement[]): void {
		for (const instance of instances) {
			this.elements.push(instance);
			instance.setScreen(this);
		}

		this.updateElements();
	}

	/**
	 * Renders/refreshes the screen
	 *
	 * @public
	 */
	public updateElements(): void {
		for (const element of this.elements) {
			const instance: Folder = element.getInstance();

			if (element instanceof UiPanel) {
				(element.components.transform as UiTransform).setSize((element.components.transform as UiTransform).getSize());
			}

			const parent = element.getParent();

			if (parent) {
				instance.Parent = parent.getInstance();
			} else {
				instance.Parent = this.getWindow();
			}
		}
	}

	/**
	 * Returns the screen's window instance
	 *
	 * @public
	 * @returns {ScreenGui} Screen's window instance
	 */
	public getWindow(): ScreenGui {
		return this.window;
	}

	/**
	 * Returns all elements of the screen under the given position
	 *
	 * @public
	 * @param {Vector2} position Position that will be used for searching
	 * @returns {UiElement[]} Elements of the screen under the given position
	 */
	public getHoveredElements(position: Vector2): UiElement[] {
		const elements: UiElement[] = [];
		for (const element of this.elements) {
			if (element instanceof UiPanel && (element.getInstance().FindFirstChild("frame") as Frame).Visible) {
				const center = (element.components.transform as UiTransform).getAnchorFrom().add((element.components.transform as UiTransform).getPosition(false));
				if (pointRectangleIntersection(position, center, (element.components.transform as UiTransform).getSize(false))) {
					elements.push(element);
				}
			}
		}
		return elements;
	}

	/**
	 * Returns all screen's elements
	 *
	 * @public
	 * @returns {UiElement[]} Elements within the screen
	 */
	public getElements(): UiElement[] {
		return this.elements;
	}
}

/**
 * Simple text element
 *
 * @export
 * @extends {UiPanel}
 */
export class UiLabel extends UiPanel {
	/**
	 * Creates an instance of UiLabel
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template to be used in creation
	 */
	public constructor(template: Folder) {
		super(template);

		this.addComponent(uiComponents.text);
	}
}

/**
 * Basic button
 *
 * Assumes that there is a frame in its template (i think it's unnecessary to standardize)
 *
 * @export
 * @extends {UiInputPanel}
 */
export class UiButton extends UiInputPanel {
	/**
	 * Creates an instance of UiButton
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template to be used in creation
	 */
	public constructor(template: Folder) {
		super(template);

		this.addComponent(uiComponents.style);
		this.addComponent(uiComponents.states);
	}
}

/**
 * Basic input panel that can be dragged
 *
 * Assumes that there is a frame in its template (i think it's unnecessary to standardize)
 *
 * @export
 * @extends {UiInputPanel}
 */
export class UiDragPanel extends UiInputPanel {
	/**
	 * Creates an instance of UiDragPanel
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template to be used in creation
	 */
	public constructor(template: Folder) {
		super(template);

		this.addComponent(uiComponents.drag);

		this.components.states?.state.onStateChange.subscribe(() => {
			this.components.style?.updateButtonStyle(uiButtonStates.default);
		});
	}
}

/**
 * Mouse drag selection "button"
 *
 * Assumes that there is a frame in its template (i think it's unnecessary to standardize)
 *
 * @export
 * @extends {UiInputPanel}
 */
export class UiSelection extends UiInputPanel {
	/**
	 * Start corner
	 *
	 * @private
	 */
	private start: Vector2 = new Vector2(0, 0);
	/**
	 * Mouse position in previous mouse movement event
	 *
	 * @protected
	 */
	protected previousMouseLocation: Vector2 | undefined;
	/**
	 * Delta of previousMouseLocation and current mouse position in the mouse movement event
	 *
	 * @protected
	 */
	protected mouseDelta: Vector2 = vector2Zero;
	/**
	 * Callback for drag selection event
	 *
	 * @public
	 * @readonly
	 */
	public readonly onDragSelection: DragSelectionInputEvent;
	/**
	 * Hidden callback caller for drag selection event
	 *
	 * @protected
	 * @readonly
	 */
	protected readonly onDragSelectionCaller: DragSelectionInputEventCaller;

	/**
	 * Creates an instance of UiSelection
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template to be used in creation
	 */
	public constructor(template: Folder) {
		super(template);

		this.addComponent(uiComponents.transform);

		[this.onDragSelection, this.onDragSelectionCaller] = createEvent() as [DragSelectionInputEvent, DragSelectionInputEventCaller];

		this.components.input?.disableMouseMoveEvent();

		this.components.input?.onClickStart.subscribe((input) => {
			if (this.components.frame === undefined) {
				throw new UiComponentLacksDependency(undefined, this, getKeyByValue(uiComponents, uiComponents.frame));
			}

			const mouseLocation = addGuiInsetOffset(new Vector2(input.Position.X, input.Position.Y), true);

			if (uiController.getHoveredElements(mouseLocation).size() > 0) {
				return;
			}

			this.start = mouseLocation;
			this.components.frame.frame.Position = UDim2.fromOffset(this.start.X, this.start.Y);
			this.components.input?.enableMouseMoveEvent();
		});

		this.components.input?.onDrag.subscribe((input) => {
			if (this.components.frame === undefined) {
				throw new UiComponentLacksDependency(undefined, this, getKeyByValue(uiComponents, uiComponents.frame));
			}

			const mouseLocation = addGuiInsetOffset(new Vector2(input.Position.X, input.Position.Y), true);

			if (!this.previousMouseLocation) {
				this.previousMouseLocation = mouseLocation;
			}

			if (!this.components.frame.frame.Visible) {
				this.components.frame.frame.Visible = true;
			}

			this.mouseDelta = mouseLocation.sub(this.previousMouseLocation);

			const minX: number = math.min(this.start.X, mouseLocation.X);
			const minY: number = math.min(this.start.Y, mouseLocation.Y);

			const maxX: number = math.max(this.start.X, mouseLocation.X);
			const maxY: number = math.max(this.start.Y, mouseLocation.Y);

			this.components.frame.frame.Position = UDim2.fromOffset(minX, minY);
			this.components.frame.frame.Size = UDim2.fromOffset(maxX - minX, maxY - minY);

			this.previousMouseLocation = mouseLocation;
		});

		this.components.input?.onClickEnd.subscribe(() => {
			if (this.components.frame === undefined) {
				throw new UiComponentLacksDependency(undefined, this, getKeyByValue(uiComponents, uiComponents.frame));
			}

			this.components.frame.frame.Visible = false;
			this.components.input?.disableMouseMoveEvent();
			this.clearSelection();
			this.components.frame.frame.Position = UDim2.fromOffset(0, 0);
			this.components.frame.frame.Size = UDim2.fromOffset(0, 0);

			this.previousMouseLocation = undefined;
		});
	}

	/**
	 * Gets bounds for unit finding
	 *
	 * @public
	 * @param {InputObject} input Input object
	 * @returns {UiSelectionBox} Selection bounds
	 */
	public getSelection(input: InputObject): UiSelectionBox {
		const output: UiSelectionBox = {
			startCorner: this.start,
			endCorner: addGuiInsetOffset(new Vector2(input.Position.X, input.Position.Y))
		}

		return output;
	}

	/**
	 * Resets selection
	 *
	 * @private
	 */
	private clearSelection(): void {
		this.start = new Vector2(0, 0);
	}
}

export class UiToggle extends UiButton {
	/**
	 * Callback for toggle event
	 *
	 * @public
	 * @readonly
	 */
	public readonly onToggle: ToggleEvent;
	/**
	 * Hidden callback caller for toggle event
	 *
	 * @protected
	 * @readonly
	 */
	protected readonly onToggleCaller: ToggleEventCaller;
	/**
	 * Is the toggle toggled
	 *
	 * @protected
	 */
	protected toggled: boolean = false;

	/**
	 * Creates an instance of UiSelection
	 *
	 * @constructor
	 * @public
	 * @param {Folder} template Element template to be used in creation
	 */
	public constructor(template: Folder) {
		super(template);

		[this.onToggle, this.onToggleCaller] = createEvent() as [ToggleEvent, ToggleEventCaller];

		this.components.style?.setStyle(uiButtonStyles.genericToggle);

		this.components.states?.state.onStateChange.subscribe((newState, oldState) => {
			if (this.components.states?.isPressed(newState) && !(this.components.states?.isPressed(oldState))) {
				this.toggled = !this.toggled;

				if (!this.toggled) {
					this.components.style?.updateButtonStyle(uiButtonStates.hovered);
				}

				this.onToggleCaller.fire(this.toggled);
			}

			if (this.toggled) {
				if (newState === uiButtonStates.hoveredAndPressed || newState === uiButtonStates.hovered) {
					this.components.style?.updateButtonStyle(uiButtonStates.hoveredAndPressed);
				} else {
					this.components.style?.updateButtonStyle(uiButtonStates.pressed);
				}
			}
		});
	}
}

// TODO (current) very complex animation system
