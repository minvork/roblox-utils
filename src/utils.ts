//!strict

// biome-ignore lint/suspicious/noShadowRestrictedNames: doesn't shadow
import { Object } from "@rbxts/jsnatives";

type IfEquals<X, Y, A = X, B = never> =
	(<T>() => T extends X ? 1 : 2) extends
	(<T>() => T extends Y ? 1 : 2) ? A : B;

// debug

/**
 * Generic alert (info in console)
 *
 * @export
 */
export class GenericAlert {
	/**
	 * Name of the alert
	 *
	 * @protected
	 * @readonly
	 */
	protected readonly name: string;
	/**
	 * Alert message
	 *
	 * @protected
	 * @readonly
	 */
	protected readonly message: string;

	/**
	 * Creates an instance of GenericAlert
	 *
	 * @constructor
	 * @public
	 * @param {string} [name="GenericAlert"] Name of the alert
	 * @param {?string} [message] Custom alert message
	 */
	public constructor(name: string = "GenericAlert", message?: string) {
		this.name = name;
		this.message = message ?? "";
	}

	/**
	 * Prints the alert message
	 *
	 * @public
	 */
	public fire(): void {
		print(`[${this.name}] ${this.message || "There is some info!"}`);
	}
}

/**
 * Generic error (error in console)
 *
 * @export
 */
export class GenericError {
	/**
	 * Creates an instance of GenericError
	 *
	 * @constructor
	 * @public
	 * @param {string} [name="GenericError"] Name of the error
	 * @param {?string} [message] Custom error message
	 */
	public constructor(name: string = "GenericError", message?: string) {
		error(`[${name}] ${message ?? "There is an error!"}`);
	}
}

/**
 * Never thrown
 *
 * For ts whims
 *
 * @export
 * @extends {GenericError}
 */
export class UnrealError extends GenericError {
	/**
	 * Creates an instance of UnrealError
	 *
	 * @constructor
	 * @public
	 * @param {?string} [message] Custom error message
	 */
	public constructor(message?: string) {
		const name = "UnrealError";

		super(name, message ?? "How this can be thrown???");
	}
}

// math

/**
 * Zero {@link Vector3}
 */
export const vector3Zero: Vector3 = new Vector3(0, 0, 0);
/**
 * Zero {@link Vector2}
 */
export const vector2Zero: Vector2 = new Vector2(0, 0);

/**
 * Returns a random integer within the given bounds
 *
 * @export
 * @param {number} min Bottom boundary of the number
 * @param {number} max Upper boundary of the number
 * @returns {number} Random integer within the given bounds
 */
export function getRandomInt(min: number, max: number): number {
	const minRound = math.ceil(min);
	const maxRound = math.floor(max);

	return math.floor(math.random() * (maxRound - minRound + 1)) + minRound;
}

/**
 * Returns a random float within the given bounds
 *
 * @export
 * @param {number} min Bottom boundary of the number
 * @param {number} max Upper boundary of the number
 * @returns {number} Random float within the given bounds
 */
export function getRandomFloat(min: number, max: number): number {
	return math.random() * (max - min) + min;
}

/**
 * Check if the given point is inside the given rectangle
 *
 * @export
 * @param {Vector2} point The point
 * @param {Vector2} position Position of the rectangle
 * @param {Vector2} size Size of the rectangle
 * @returns {boolean} Is the given point inside the given rectangle
 */
export function pointRectangleIntersection(point: Vector2, position: Vector2, size: Vector2): typeof xOverlap | typeof yOverlap {
	const xOverlap = point.X >= position.X - size.X / 2 && point.X <= position.X + size.X / 2;
	const yOverlap = point.Y >= position.Y - size.Y / 2 && point.Y <= position.Y + size.Y / 2;

	return xOverlap && yOverlap;
}

/**
 * Converts the given rgb value to a {@link Color3} value
 *
 * @export
 * @param {number} r Red
 * @param {number} g Green
 * @param {number} b Blue
 * @returns {Color3} Converted {@link Color3} value
 */
export function rgbToColor3(r: number, g: number, b: number): Color3 {
	return new Color3(r / 255, g / 255, b / 255);
}

// events

/**
 * Generic event
 *
 * @export
 * @template {unknown[]} EventData Type of the event data
 */
export interface GenericEvent<EventData extends unknown[]> {
	/**
	 * Subscribes to the event
	 *
	 * @param {(...args: EventData) => void} callback The function to be called when the event fires
	 * @returns {number} An unique subscription id for unsubscribing
	 */
	subscribe: (callback: (...args: EventData) => void) => number;

	/**
	 * Unsubscribes from the event
	 *
	 * @param {number} id The subscription id returned from {@link subscribe}
	 */
	unsubscribe: (id: number) => void;

	/**
	 * Unsubscribes all listeners from the event
	 */
	unsubscribeAll: () => void;
}

/**
 * Generic event caller
 *
 * @export
 * @template {unknown[]} EventData Type of the event data
 */
export interface GenericEventCaller<EventData extends unknown[]> {
	/**
	 * Fires all callbacks provided by the event listeners
	 *
	 * @param {...EventData} args Event data to pass
	 */
	fire: (...args: EventData) => void;
}

/**
 * Creates a new event and its caller
 *
 * @export
 * @template {unknown[]} EventData Type of the event data
 * @returns {[GenericEvent<EventData>, GenericEventCaller<EventData>]} Event and its caller
 */
export function createEvent<EventData extends unknown[]>(): [GenericEvent<EventData>, GenericEventCaller<EventData>] {
	let listeners: ((...args: EventData) => void)[] = [];

	const subscribe = (callback: (...args: EventData) => void): number => {
		listeners.push(callback);
		return listeners.size() - 1;
	}

	const unsubscribe = (id: number): void => {
		listeners.remove(id);
	}

	const unsubscribeAll = (): void => {
		listeners = [];
	}

	const fire = (...args: EventData): void => {
		for (const listener of listeners) {
			listener?.(...args);
		}
	}

	const event: GenericEvent<EventData> = { subscribe, unsubscribe, unsubscribeAll };
	const caller: GenericEventCaller<EventData> = { fire };

	return [event, caller];
}

// other

/**
 * Returns the value type of the given type
 *
 * @export
 * @template ObjectType Target type
 */
export type ValueOf<ObjectType> = ObjectType[keyof ObjectType];

/**
 * Returns key of the given object by its given value
 *
 * @export
 * @template {object} ObjectType Type of the object
 * @template ValueType Type of the value
 * @param {object} obj The object
 * @param {ValueType} value Value of the given object
 * @returns {(keyof ObjectType | undefined)} Key of the given object
 */
export function getKeyByValue<ObjectType extends object, ValueType>(obj: ObjectType, value: ValueType): keyof ObjectType | undefined {
	return (Object.keys(obj) as Array<keyof ObjectType>).find(
		(key) => obj[key] === (value as unknown as ObjectType[keyof ObjectType])
	);
}

export type WritableKeysOf<T> = {
	[P in keyof T]-?: IfEquals<
		{ [Q in P]: T[P] },
		{ -readonly [Q in P]: T[P] },
		P
	>
}[keyof T];
