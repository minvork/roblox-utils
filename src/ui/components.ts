//!strict

import { uiInitializer, UiNotInitializedError, InvalidUiConstraintArgumentsError, UiComponentLacksDependency, type GenericInputEvent, type GenericInputEventCaller, absoluteToRelativeVector2, addGuiInsetOffset, type InputBindings, type InputModifiers, udim2ToVector2, UnknownUiComponentError, type InputModifiersState, uiButtonStates, type UiButtonState, type ButtonStateArgs } from "./helpers";
import type { UiElement } from "./uiController";
import { UserInputService } from "@rbxts/services";
// biome-ignore lint/suspicious/noShadowRestrictedNames: doesn't shadow
import { ArrayUtils, Object } from "@rbxts/jsnatives";
import { blurController } from "../modules/uiBlur";
import { stateController, type State, type StateArgs, type StateObject } from "../system/stateController";
import { createEvent, vector2Zero, getKeyByValue, pointRectangleIntersection, rgbToColor3 } from "../utils";

/**
 * Lmb flag
 *
 * * Temporary
 * @export
 */
// TODO (some day...) replace this field with an input manager
let somethingPressed: boolean;

interface UiElementStyle {
	readonly color: Color3;
	readonly edgeColor: Color3;
	readonly shadowSize: Vector2;
}

type UiElementStyles = {
	readonly [Key in keyof typeof uiButtonStates]: UiElementStyle;
}

interface UiElementStylesSet {
	readonly [key: string]: UiElementStyles;
}

/**
 * Component placeholder
 */
const blankComponent = ((): void => undefined) as unknown as UiComponentFunc<UiComponent>;

/**
 * Ui components
 */
const uiComponentsTemp: UiComponentFuncs<ButtonStateArgs> = {
	frame: blankComponent as UiComponentFunc<UiFrame>,
	transform: blankComponent as UiComponentFunc<UiTransform>,
	style: blankComponent as UiComponentFunc<UiStyle>,
	text: blankComponent as UiComponentFunc<UiText>,
	input: blankComponent as UiComponentFunc<UiInput>,
	states: blankComponent as UiComponentFunc<UiStates<ButtonStateArgs>>,
	drag: blankComponent as UiComponentFunc<UiDrag>
}

uiComponentsTemp.frame = (element: UiElement): UiFrame => {
	const output: UiFrame = {
		name: getKeyByValue(uiComponents, uiComponents.frame),
		dependencies: [] as UiComponentFunc<UiComponent>[],
		frame: element.getInstance().FindFirstChild("frame") as Frame
	} as UiFrame;

	return output;
}

uiComponentsTemp.transform = (element: UiElement): UiTransform => {
	const output: UiTransform = {
		name: getKeyByValue(uiComponents, uiComponents.transform),
		dependencies: [uiComponents.frame],
		anchorFrom: new Vector2(0.5, 0.5),
		lastAspectRatio: 1
	} as UiTransform;

	output.compensateAspectRatio = (positionOrX: Vector2 | number, y?: number): Vector2 => {
		if (!uiInitializer.isUiInitialized()) {
			throw new UiNotInitializedError(undefined, element);
		}

		const aspect = (uiInitializer.screenSize as Vector2).X / (uiInitializer.screenSize as Vector2).Y;

		output.lastAspectRatio = aspect;

		if (typeIs(positionOrX, "number") && y !== undefined) {
			return new Vector2(positionOrX / aspect, y);
		}

		if (typeIs(positionOrX, "Vector2")) {
			return new Vector2(positionOrX.X / aspect, positionOrX.Y);
		}

		throw new InvalidUiConstraintArgumentsError(positionOrX, y);
	}

	output.uncompensateAspectRatio = (position: Vector2): Vector2 => {
		if (!uiInitializer.isUiInitialized()) {
			throw new UiNotInitializedError(undefined, element);
		}

		const aspect = output.lastAspectRatio;

		return new Vector2(position.X * aspect, position.Y);
	}

	output.getSize = (uncompensate: boolean = true): Vector2 => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		if (uncompensate) {
			return output.uncompensateAspectRatio(udim2ToVector2(element.components.frame.frame.Size));
		}

		return udim2ToVector2(element.components.frame.frame.Size);
	}

	output.setSize = (valueOrX: Vector2 | number, y?: number): void => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		let normalized: Vector2;

		if (typeIs(valueOrX, "number") && y !== undefined) {
			normalized = output.compensateAspectRatio(valueOrX, y);
		} else {
			normalized = output.compensateAspectRatio(valueOrX);
		}

		element.components.frame.frame.Size = new UDim2(normalized.X, 0, normalized.Y, 0);
	}

	output.getAnchorFrom = (): Vector2 => output.anchorFrom;

	output.setAnchorFrom = (valueOrX: Vector2 | number, y?: number): void => {
		if (typeIs(valueOrX, "number") && y !== undefined) {
			output.setPosition(new Vector2(valueOrX + output.getPosition().X, y + output.getPosition().Y));
			output.anchorFrom = new Vector2(valueOrX, y);
			return;
		}

		if (typeIs(valueOrX, "Vector2")) {
			output.anchorFrom = valueOrX;
			output.setPosition(output.getPosition());
			return;
		}

		throw new InvalidUiConstraintArgumentsError(valueOrX, y);
	}

	output.getAnchorTo = (): Vector2 => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		return element.components.frame.frame.AnchorPoint;
	}

	output.setAnchorTo = (valueOrX: Vector2 | number, y?: number): void => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		if (typeIs(valueOrX, "number") && y !== undefined) {
			element.components.frame.frame.AnchorPoint = new Vector2(valueOrX, y);
			return;
		}

		if (typeIs(valueOrX, "Vector2")) {
			element.components.frame.frame.AnchorPoint = valueOrX;
			return;
		}

		throw new InvalidUiConstraintArgumentsError(valueOrX, y);
	}

	output.getPosition = (uncompensate: boolean = true): Vector2 => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		if (uncompensate) {
			return output.uncompensateAspectRatio(udim2ToVector2(element.components.frame.frame.Position).sub(output.anchorFrom));
		}

		return udim2ToVector2(element.components.frame.frame.Position).sub(output.anchorFrom);
	}

	output.setPosition = (positionOrX: Vector2 | number, y?: number): void => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		if (typeIs(positionOrX, "number") && y !== undefined) {
			element.components.frame.frame.Position = new UDim2(output.anchorFrom.X + positionOrX, 0, output.anchorFrom.Y + y, 0);

			return;
		}

		if (typeIs(positionOrX, "Vector2")) {
			element.components.frame.frame.Position = new UDim2(output.anchorFrom.X + positionOrX.X, 0, output.anchorFrom.Y + positionOrX.Y, 0);

			return;
		}

		throw new InvalidUiConstraintArgumentsError(positionOrX, y);
	}

	return output;
}

uiComponentsTemp.style = (element: UiElement): UiStyle => {
	const output: UiStyle = {
		name: getKeyByValue(uiComponents, uiComponents.style),
		dependencies: [uiComponents.frame],
		edge: (element.getInstance().FindFirstChild("frame") as Frame).FindFirstChild("edge") as UIStroke,
		shadow: (element.getInstance().FindFirstChild("frame") as Frame).FindFirstChild("shadow") as ImageLabel,
		backgroundBlurState: false,
		style: uiButtonStyles.generic
	} as UiStyle;

	element.onRemove.subscribe(() => {
		output.removeHandler();
	});

	output.removeHandler = (): void => {
		output.setBackgroundBlur(false);
	}

	output.getBackgroundBlur = (): boolean => output.backgroundBlurState;

	output.setBackgroundBlur = (value: boolean): void => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		if (value) {
			blurController.bindFrame(element.components.frame.frame, {
				// biome-ignore lint/style/useNamingConvention: hardcoded key
				Transparency: 0.9999,
				// biome-ignore lint/style/useNamingConvention: hardcoded key
				BrickColor: new BrickColor("Institutional white")
			});
		} else {
			blurController.unbindFrame(element.components.frame.frame);
		}

		output.backgroundBlurState = value;
	}

	output.setColor = (value: Color3): void => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		element.components.frame.frame.BackgroundColor3 = value;
	}

	output.getColor = (): Color3 => {
		if (element.components.frame === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
		}

		return element.components.frame.frame.BackgroundColor3;
	}

	output.setEdgeColor = (value: Color3): void => {
		output.edge.Color = value;
	}

	output.getEdgeColor = (): Color3 => output.edge.Color;

	output.setShadowSize = (valueOrX: Vector2 | number, y?: number): void => {
		let normalized: Vector2 = vector2Zero;

		if (typeIs(valueOrX, "number") && y !== undefined) {
			normalized = new Vector2(valueOrX, y);
		} else if (typeIs(valueOrX, "Vector2")) {
			normalized = valueOrX;
		}

		output.shadow.Size = new UDim2(normalized.X, 0, normalized.Y, 0);
	}

	output.updateButtonStyle = (state: UiButtonState): void => {
		const key = getKeyByValue(uiButtonStates, state);

		if (!key) {
			throw new UnknownUiComponentError(undefined, element);
		}

		output.setColor(output.style[key].color);
		output.setEdgeColor(output.style[key].edgeColor);
		output.setShadowSize(output.style[key].shadowSize);
	}

	output.setStyle = (style: UiElementStyles): void => {
		output.style = style;
	}

	return output;
}

uiComponentsTemp.text = (element: UiElement): UiText => {
	if (element.components.frame === undefined) {
		throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.frame));
	}

	const output: UiText = {
		name: getKeyByValue(uiComponents, uiComponents.text),
		dependencies: [uiComponents.frame],
		text: "",
		label: element.components.frame.frame.FindFirstChild("label") as TextLabel
	} as UiText;

	output.setText = (value: string): void => {
		output.text = value;
		output.label.Text = output.text;
	}

	return output;
}

uiComponentsTemp.input = (element: UiElement): UiInput => {
	const output: UiInput = {
		name: getKeyByValue(uiComponents, uiComponents.input),
		dependencies: [uiComponents.transform],
		mouseMoveEvent: undefined,
		clickStartEvent: undefined,
		clickEndEvent: undefined,
		bindings: {
			main: [] as Enum.UserInputType[],
			secondary: [] as Enum.UserInputType[],
			drag: [] as Enum.UserInputType[]
		},
		enabled: true,
		modifiers: {
			ctrl: undefined,
			shift: undefined,
			alt: undefined
		},
		currentModifiers: {
			ctrl: false,
			shift: false,
			alt: false
		}
	} as UiInput;

	[output.onClickStart, output.onClickStartCaller] = createEvent() as [GenericInputEvent, GenericInputEventCaller];
	[output.onDrag, output.onDragCaller] = createEvent() as [GenericInputEvent, GenericInputEventCaller];
	[output.onClickEnd, output.onClickEndCaller] = createEvent() as [GenericInputEvent, GenericInputEventCaller];

	element.onRemove.subscribe(() => {
		output.removeHandler();
	});

	output.removeHandler = (): void => {
		output.clearEvents();
	}

	output.clearEvents = (): void => {
		output.disableMouseMoveEvent();
		output.disableClickEvents();

		output.onClickStart.unsubscribeAll();
		output.onDrag.unsubscribeAll();
		output.onClickEnd.unsubscribeAll();
	}

	output.enableMouseMoveEvent = (): void => {
		output.disableMouseMoveEvent();

		/* let firstTick: number | undefined;
		let midTime: number = 0; */

		output.mouseMoveEvent = UserInputService.InputChanged.Connect((input: InputObject) => {
			/* if (!firstTick) {
				firstTick = os.clock();
			}

			const delta = os.clock() - firstTick;

			if (delta >= 1) {
				print(midTime * 1000, "ms");
				firstTick = os.clock();
			}

			const start = os.clock(); */

			output.dragHandler(input);

			/* const finish = os.clock();

			midTime += 0.5 * ((finish - start) - midTime); */
		});
	}

	output.disableMouseMoveEvent = (): void => {
		output.mouseMoveEvent?.Disconnect();
	}

	output.enableClickEvents = (): void => {
		output.disableClickEvents();

		output.clickStartEvent = UserInputService.InputBegan.Connect((input: InputObject, processed: boolean) => {
			output.inputStartHandler(input, processed);
		});

		output.clickEndEvent = UserInputService.InputEnded.Connect((input: InputObject) => {
			output.inputEndHandler(input);
		});
	}

	output.disableClickEvents = (): void => {
		output.clickStartEvent?.Disconnect();
		output.clickEndEvent?.Disconnect();
	}

	output.inputProcessor = (input: InputObject, processed?: boolean): keyof InputBindings | undefined => {
		const inputState = input.UserInputState;

		switch (input.KeyCode) {
			case Enum.KeyCode.LeftControl:
				if (output.modifiers.ctrl) {
					output.modifiers.ctrl();
				}

				if (inputState === Enum.UserInputState.Begin) {
					output.currentModifiers.ctrl = true;
				} else if (inputState === Enum.UserInputState.End) {
					output.currentModifiers.ctrl = false;
				}

				return;
			case Enum.KeyCode.LeftShift:
				if (output.modifiers.shift) {
					output.modifiers.shift();
				}

				if (inputState === Enum.UserInputState.Begin) {
					output.currentModifiers.shift = true;
				} else if (inputState === Enum.UserInputState.End) {
					output.currentModifiers.shift = false;
				}

				return;
			case Enum.KeyCode.LeftAlt:
				if (output.modifiers.alt) {
					output.modifiers.alt();
				}

				if (inputState === Enum.UserInputState.Begin) {
					output.currentModifiers.alt = true;
				} else if (inputState === Enum.UserInputState.End) {
					output.currentModifiers.alt = false;
				}

				return;

			default:
				break;
		}

		if (processed || !output.enabled) {
			return;
		}

		const inputType = output.resolveInputType(input);

		return inputType;
	}

	output.isDrag = (inputType: keyof InputBindings | undefined): boolean => inputType === getKeyByValue(output.bindings, output.bindings.drag);

	output.inputStartHandler = (input: InputObject, processed: boolean): void => {
		const inputType = output.inputProcessor(input, processed);

		if (!inputType) {
			return;
		}

		if (output.isDrag(inputType)) {
			return;
		}

		output.onClickStartCaller.fire(input, {
			type: inputType,
			modifiers: output.currentModifiers
		});
	}

	output.dragHandler = (input: InputObject): void => {
		const inputType = output.inputProcessor(input);

		if (!inputType) {
			return;
		}

		if (!output.isDrag(inputType)) {
			return;
		}

		output.onDragCaller.fire(input, {
			type: inputType,
			modifiers: output.currentModifiers
		});
	}

	output.inputEndHandler = (input: InputObject): void => {
		const inputType = output.inputProcessor(input);

		if (!inputType) {
			return;
		}

		if (output.isDrag(inputType)) {
			return;
		}

		output.onClickEndCaller.fire(input, {
			type: inputType,
			modifiers: output.currentModifiers
		});
	}

	output.resolveInputType = (input: InputObject): keyof InputBindings | undefined => {
		const bindings = output.getBindings();

		return Object.keys(bindings).find((inputCategory) => {
			const value = bindings[inputCategory];

			if (ArrayUtils.isArray(value) && value.includes(input.UserInputType)) {
				return true;
			}

			return false;
		});
	}

	output.setBindings = (bindings: InputBindings): void => {
		output.bindings = bindings;
	}
	output.setModifiers = (modifiers: InputModifiers): void => {
		output.modifiers = modifiers;
	}

	output.getBindings = (): InputBindings => output.bindings;
	output.getModifiers = (): InputModifiers => output.modifiers;

	output.isHovered = (position: Vector3): boolean => {
		if (element.components.transform === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.transform));
		}

		const mouseLocation = addGuiInsetOffset(new Vector2(position.X, position.Y), true);

		const center = element.components.transform.getAnchorFrom().add(element.components.transform.getPosition(false));

		return pointRectangleIntersection(absoluteToRelativeVector2(mouseLocation), center, element.components.transform.getSize(false));
	}

	output.enable = (): void => {
		output.enabled = true;
		output.enableMouseMoveEvent();
		output.enableClickEvents();
	}

	output.disable = (): void => {
		output.enabled = false;
		output.disableMouseMoveEvent();
		output.disableClickEvents();
	}

	output.enableMouseMoveEvent();
	output.enableClickEvents();

	return output;
}

uiComponentsTemp.states = (element: UiElement): UiStates<ButtonStateArgs> => {
	if (element.components.input === undefined) {
		throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.input));
	}

	const output: UiStates<ButtonStateArgs> = {
		name: getKeyByValue(uiComponents, uiComponents.states),
		dependencies: [uiComponents.input],
		pressed: false,
		state: stateController.createStateObject<ButtonStateArgs>(uiButtonStates)
	} as UiStates<ButtonStateArgs>;

	output.isPressed = (state: State<ButtonStateArgs> | undefined): boolean => {
		if (state === uiButtonStates.pressed || state === uiButtonStates.hoveredAndPressed) {
			return true;
		}

		return false;
	}

	output.inputProcessor = (input: InputObject, pressed: boolean): void => {
		if (element.components.input === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.input));
		}

		const hovered = element.components.input.isHovered(input.Position);

		somethingPressed = pressed;

		stateController.updateState(output.state, {
			hovered,
			pressed
		});
	}

	element.components.input.onClickStart.subscribe((input): void => {
		output.inputProcessor(input, true);
	});

	element.components.input.onDrag.subscribe((input): void => {
		const pressed = output.isPressed(stateController.getCurrentState(output.state));

		output.inputProcessor(input, pressed);
	});

	element.components.input.onClickEnd.subscribe((input): void => {
		output.inputProcessor(input, false);
	});

	output.state.onStateChange.subscribe((newState) => {
		if (element.components.style) {
			element.components.style.updateButtonStyle(newState);
		}
	});

	return output;
}

uiComponentsTemp.drag = (element: UiElement): UiDrag => {
	if (element.components.input === undefined) {
		throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.input));
	}

	const output: UiDrag = {
		name: getKeyByValue(uiComponents, uiComponents.drag),
		dependencies: [uiComponents.states, uiComponents.input, uiComponents.transform],
		draggable: true,
		previousMouseLocation: undefined
	} as UiDrag;

	element.components.input.onDrag.subscribe((input): void => {
		if (!output.draggable) {
			return;
		}

		if (element.components.transform === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.transform));
		}

		if (element.components.states === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.states));
		}

		if (element.components.input === undefined) {
			throw new UiComponentLacksDependency(undefined, element, getKeyByValue(uiComponents, uiComponents.input));
		}

		const mouseLocation = addGuiInsetOffset(new Vector2(input.Position.X, input.Position.Y), true);

		if (!output.previousMouseLocation) {
			output.previousMouseLocation = mouseLocation;
		}

		output.mouseDelta = mouseLocation.sub(output.previousMouseLocation);

		const currentState = stateController.getCurrentState(element.components.states.state);

		if (element.components.states.isPressed(currentState)) {
			element.components.transform.setPosition(element.components.transform.getPosition(false).add(absoluteToRelativeVector2(output.mouseDelta)));
		}

		output.previousMouseLocation = mouseLocation;
	});

	output.setDrag = (enabled: boolean): void => {
		output.draggable = enabled;
	}

	return output;
}

const uiComponents = table.freeze(uiComponentsTemp);

/**
 * Union type of all the available components
 *
 * @export
 */
type UiComponentInherited = UiFrame | UiTransform | UiStyle | UiText | UiInput | UiStates<StateArgs> | UiDrag;

export { uiComponents };

/**
 * Ui component
 *
 * @export
 */
export interface UiComponent {
	/**
	 * Name of the component
	 * @readonly
	 */
	readonly name: keyof UiComponentFuncs<ButtonStateArgs>;
	/**
	 * Dependencies of the component
	 * @readonly
	 */
	readonly dependencies: UiComponentFunc<UiComponentInherited>[];
}

/**
 * Component function/method of the given component type
 *
 * @export
 * @template {UiComponent} ComponentType Component type
 */
export type UiComponentFunc<ComponentType extends UiComponent> = (element: UiElement) => ComponentType;

/**
 * Component functions/methods type for each type of component
 *
 * @export
 */
export interface UiComponentFuncs<StateArgsType extends StateArgs> {
	/**
	* Component with the frame instance
	*
	* * Dependencies: *none*
	* @export
	* @extends {UiComponent}
	*/
	frame: UiComponentFunc<UiFrame>;
	/**
	* Component with some transform functionality
	*
	* * Dependencies: {@link UiFrame}
	* @export
	* @extends {UiComponent}
	*/
	transform: UiComponentFunc<UiTransform>;
	/**
	* Component with some styling functionality
	*
	* * Dependencies: {@link UiFrame}
	* @export
	* @extends {UiComponent}
	*/
	style: UiComponentFunc<UiStyle>;
	/**
	* Text component
	*
	* * Dependencies: {@link UiFrame}
	* @export
	* @extends {UiComponent}
	*/
	text: UiComponentFunc<UiText>;
	/**
	* Component with some input events
	*
	* * Dependencies: {@link UiTransform}
	* @export
	* @extends {UiComponent}
	*/
	input: UiComponentFunc<UiInput>;
	/**
	* Component with a state machine
	*
	* * Dependencies: {@link UiInput}
	* @export
	* @extends {UiComponent}
	*/
	states: UiComponentFunc<UiStates<StateArgsType>>;
	/**
	 * Component that allows an element to be draggable
	*
	* * Dependencies: {@link UiStates}, {@link UiInput}, {@link UiTransform}
	* @export
	* @extends {UiComponent}
	*/
	drag: UiComponentFunc<UiDrag>;
}

/**
 * Component with the frame instance
 *
 * * Dependencies: *none*
 * @export
 * @extends {UiComponent}
 */
export interface UiFrame extends UiComponent {
	/**
	 * Frame instance
	 * @readonly
	 */
	readonly frame: Frame;
}

/**
 * Component with some transform functionality
 *
 * * Dependencies: {@link UiFrame}
 * @export
 * @extends {UiComponent}
 */
export interface UiTransform extends UiComponent {
	/**
	 * Element's start position on the screen
	 */
	anchorFrom: Vector2;

	/**
	 * Element's aspect ration from the last compensateAspectRatio call
	 */
	lastAspectRatio: number;

	/**
	 * Compensates position according to the current screen aspect ratio
	 *
	 * @param {Vector2 | number} positionOrX {@link Vector2} or the x coordinate
	 * @param {number} y The y coordinate if the first is x
	 * @returns {Vector2} The compensated position
	 */
	compensateAspectRatio: (positionOrX: Vector2 | number, y?: number) => Vector2;

	/**
	 * Uncompensates position according to the current screen aspect ratio
	 *
	 * @param {Vector2} position The compensated position
	 * @returns {Vector2} The uncompensated position
	 */
	uncompensateAspectRatio: (position: Vector2) => Vector2;

	/**
	 * Returns relative size
	 *
	 * @param {boolean} uncompensate Should the returned value be uncompensated
	 * @returns {Vector2} The relative size
	 */
	getSize: (uncompensate?: boolean) => Vector2;

	/**
	 * Sets relative size
	 *
	 * @param {Vector2 | number} positionOrX {@link Vector2} or the x coordinate
	 * @param {number} y The y coordinate if the first is x
	 */
	setSize: (valueOrX: Vector2 | number, y?: number) => void;

	/**
	 * Returns element's start position on the screen
	 *
	 * @returns {Vector2} The element's start position on the screen
	 */
	getAnchorFrom: () => Vector2;

	/**
	 * Sets element's start position on the screen
	 *
	 * @param {Vector2 | number} positionOrX {@link Vector2} or the x coordinate
	 * @param {number} y The y coordinate if the first is x
	 */
	setAnchorFrom: (valueOrX: Vector2 | number, y?: number) => void;

	/**
	 * Returns element's start position in the element
	 *
	 * @returns {Vector2} The element's start position in the element
	 */
	getAnchorTo: () => Vector2;

	/**
	 * Sets element's start position in the element
	 *
	 * @param {Vector2 | number} positionOrX {@link Vector2} or the x coordinate
	 * @param {number} y The y coordinate if the first is x
	 */
	setAnchorTo: (valueOrX: Vector2 | number, y?: number) => void;

	/**
	 * Returns relative position
	 *
	 * @param {boolean} uncompensate Should the returned value be uncompensated
	 * @returns {Vector2} The relative size
	 */
	getPosition: (uncompensate?: boolean) => Vector2;

	/**
	 * Sets relative position
	 *
	 * @param {Vector2 | number} positionOrX {@link Vector2} or the x coordinate
	 * @param {number} y The y coordinate if the first is x
	 */
	setPosition: (positionOrX: Vector2 | number, y?: number) => void;
}

/**
 * Component with some styling functionality
 *
 * * Dependencies: {@link UiFrame}
 * @export
 * @extends {UiComponent}
 */
export interface UiStyle extends UiComponent {
	/**
	 * Visual edge of the element
	 * @readonly
	 */
	readonly edge: UIStroke;

	/**
	 * Visual shadow of the element
	 * @readonly
	 */
	readonly shadow: ImageLabel;

	/**
	 * Is the element background blur enabled
	 */
	backgroundBlurState: boolean;
	/**
	 * Style of the element
	 */
	style: UiElementStyles;

	/**
	 * Disables background blur of the component
	 */
	removeHandler: () => void;

	/**
	 * Returns background blur state
	 *
	 * @returns {boolean} The background blur state
	 */
	getBackgroundBlur: () => boolean;

	/**
	 * Sets background blur state
	 *
	 * @param {boolean} value State to apply
	 */
	setBackgroundBlur: (value: boolean) => void;

	/**
	 * Sets element color
	 *
	 * @param {Color3} value The color to be used by the element
	 */
	setColor: (value: Color3) => void;

	/**
	 * Returns element color
	 *
	 * @returns {Color3} The element's color
	 */
	getColor: () => Color3;

	/**
	 * Sets element edge color
	 *
	 * @param {Color3} value The color to be used by the element edge
	 */
	setEdgeColor: (value: Color3) => void;

	/**
	 * Returns edge color
	 *
	 * @returns {Color3} The edge color
	 */
	getEdgeColor: () => Color3;

	/**
	 * Sets element shadow size
	 *
	 * @param {Vector2 | number} positionOrX {@link Vector2} or the x coordinate
	 * @param {number} y The y coordinate if the first is x
	 */
	setShadowSize: (valueOrX: Vector2 | number, y?: number) => void;

	/**
	 * Updates button style according to the given state
	 *
	 * @param {UiButtonState} state Button state to be used while deciding what style to set
	 */
	updateButtonStyle: (state: UiButtonState) => void;

	/**
	 * Sets element style
	 *
	 * @param {ButtonStyles} style New style
	 */
	setStyle: (style: UiElementStyles) => void;
}

/**
 * Text component
 *
 * * Dependencies: {@link UiFrame}
 * @export
 * @extends {UiComponent}
 */
export interface UiText extends UiComponent {
	/**
	 * Text in the element
	 */
	text: string;

	/**
	 * Label instance
	 * @readonly
	 */
	readonly label: TextLabel;

	/**
	 * Sets the element's text
	 *
	 * @param {string} value The text to be used by the element
	 */
	setText: (value: string) => void;
}

/**
 * Component with some input events
 *
 * * Dependencies: {@link UiTransform}
 * @export
 * @extends {UiComponent}
 */
export interface UiInput extends UiComponent {
	/**
	 * Mouse movement event
	 */
	mouseMoveEvent: RBXScriptConnection | undefined;
	/**
	 * Click start event
	 */
	clickStartEvent: RBXScriptConnection | undefined;
	/**
	 * Click end event
	 */
	clickEndEvent: RBXScriptConnection | undefined;
	/**
	 * Callback for click start event
	 */
	onClickStart: GenericInputEvent;
	/**
	 * Callback for mouse movement event
	 */
	onDrag: GenericInputEvent;
	/**
	 * Callback for click end event
	 */
	onClickEnd: GenericInputEvent;
	/**
	 * Hidden callback caller for click start event
	 */
	onClickStartCaller: GenericInputEventCaller;
	/**
	 * Hidden callback caller for mouse movement event
	 */
	onDragCaller: GenericInputEventCaller;
	/**
	 * Hidden callback caller for click end event
	 */
	onClickEndCaller: GenericInputEventCaller;
	/**
	 * Input bindings for all actions in one
	 */
	bindings: InputBindings;
	/**
	 * Can the element be interacted
	 */
	enabled: boolean;
	modifiers: InputModifiers;
	currentModifiers: InputModifiersState;

	/**
	 * Removes all event connections of the component
	 */
	removeHandler: () => void;

	/**
	 * Unsubscribes from all events and all listeners of element's events
	 */
	clearEvents: () => void;

	/**
	 * Subscribes to the mouse movement event
	 */
	enableMouseMoveEvent: () => void;

	/**
	 * Unsubscribes from the mouse movement event
	 */
	disableMouseMoveEvent: () => void;

	/**
	 * Subscribes to the click events
	 */
	enableClickEvents: () => void;

	/**
	 * Unsubscribes from the click events
	 */
	disableClickEvents: () => void;

	inputProcessor: (input: InputObject, processed?: boolean) => keyof InputBindings | undefined;

	isDrag: (inputType: keyof InputBindings | undefined) => boolean;

	/**
	 * Input event handler for click start event
	 *
	 * @param {InputObject} input Input object
	 * @param {boolean} processed Is the event procesed by engine
	 */
	inputStartHandler: (input: InputObject, processed: boolean) => void;

	/**
	 * Input event handler for mouse movement event
	 *
	 * @param {InputObject} input Input object
	 */
	dragHandler: (input: InputObject) => void;

	/**
	 * Input event handler for click end event
	 *
	 * @param {InputObject} input Input object
	 */
	inputEndHandler: (input: InputObject) => void;

	/**
	 * Resolves given input's category
	 *
	 * @param {InputObject} input Input object to use
	 */
	resolveInputType: (input: InputObject) => keyof InputBindings | undefined;

	/**
	 * Sets the element's input bindings
	 *
	 * @param {InputBindings} bindings Input bindings to use
	 */
	setBindings: (bindings: InputBindings) => void;

	/**
	 * Sets the element's input modifiers
	 *
	 * @param {InputModifiers} modifiers Input modifiers to use
	 */
	setModifiers: (modifiers: InputModifiers) => void;

	/**
	 * Returns the element's input bindings
	 */
	getBindings: () => InputBindings;

	/**
	 * Returns the element's input modifiers
	 */
	getModifiers: () => InputModifiers;

	/**
	 * Checks if the element is under the given position
	 *
	 * @param {Vector3} position Position to be used in element bounds searching
	 * @returns {boolean} Is the element under the given position
	 */
	isHovered: (position: Vector3) => boolean;

	/**
	 * Makes the element interactive
	 */
	enable: () => void;

	/**
	 * Makes the element non interactive
	 */
	disable: () => void;
}

/**
 * Component with a state machine
 *
 * * Dependencies: {@link UiInput}
 * @export
 * @extends {UiComponent}
 */
export interface UiStates<StateArgsType extends StateArgs> extends UiComponent {
	/**
	 * Is the element pressed
	 * @readonly
	 */
	readonly pressed: boolean;
	/**
	 * State object of the element
	 * @readonly
	 */
	readonly state: StateObject<StateArgsType>;

	isPressed: (state: State<StateArgsType> | undefined) => boolean;

	inputProcessor: (input: InputObject, pressed: boolean) => void;

	/**
	 * Input event handler for click start event
	 *
	 * @param {InputObject} input Input object
	 * @param {boolean} processed Is the event procesed by engine
	 */
	inputStartHandler: (input: InputObject, processed: boolean) => void;

	/**
	 * Input event handler for mouse movement event
	 *
	 * @param {InputObject} input Input object
	 */
	dragHandler: (input: InputObject) => void;

	/**
	 * Input event handler for click end event
	 *
	 * @param {InputObject} input Input object
	 */
	inputEndHandler: (input: InputObject) => void;
}

/**
 * Component that allows an element to be draggable
 *
 * * Dependencies: {@link UiStates}, {@link UiInput}, {@link UiTransform}
 * @export
 * @extends {UiComponent}
 */
export interface UiDrag extends UiComponent {
	/**
	 * Is the element draggable
	 */
	draggable: boolean;
	/**
	 * Mouse position in previous mouse movement event
	 */
	previousMouseLocation: Vector2 | undefined;
	/**
	 * Delta of previousMouseLocation and current mouse position in the mouse movement event
	 */
	mouseDelta: Vector2;

	/**
	 * Input event handler for mouse movement event
	 *
	 * @param {InputObject} input Input object
	 */
	dragHandler: (input: InputObject) => void;

	/**
	 * Changes drag state of the element
	 *
	 * @param {boolean} enabled Will the element now be draggable
	 */
	setDrag: (enabled: boolean) => void;
}

export function isSomethingPressed(): typeof somethingPressed {
	return somethingPressed;
}

export const uiButtonStyles: UiElementStylesSet = {
	generic: {
		default: {
			color: rgbToColor3(0, 0, 0),
			edgeColor: rgbToColor3(50, 50, 50),
			shadowSize: new Vector2(1.0, 1.0)
		},
		hovered: {
			color: rgbToColor3(10, 10, 10),
			edgeColor: rgbToColor3(125, 125, 125),
			shadowSize: new Vector2(1.0, 1.0)
		},
		pressed: {
			color: rgbToColor3(30, 30, 30),
			edgeColor: rgbToColor3(50, 50, 50),
			shadowSize: new Vector2(1.075, 1.075)
		},
		hoveredAndPressed: {
			color: rgbToColor3(30, 30, 30),
			edgeColor: rgbToColor3(125, 125, 125),
			shadowSize: new Vector2(1.075, 1.075)
		}
	},
	genericToggle: {
		default: {
			color: rgbToColor3(0, 0, 0),
			edgeColor: rgbToColor3(50, 50, 50),
			shadowSize: new Vector2(1.0, 1.0)
		},
		hovered: {
			color: rgbToColor3(10, 10, 10),
			edgeColor: rgbToColor3(125, 125, 125),
			shadowSize: new Vector2(1.0, 1.0)
		},
		pressed: {
			color: rgbToColor3(50, 50, 50),
			edgeColor: rgbToColor3(50, 50, 50),
			shadowSize: new Vector2(1.0, 1.0)
		},
		hoveredAndPressed: {
			color: rgbToColor3(50, 50, 50),
			edgeColor: rgbToColor3(125, 125, 125),
			shadowSize: new Vector2(1.0, 1.0)
		}
	}
} as const;
