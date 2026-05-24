//!strict

// biome-ignore lint/suspicious/noShadowRestrictedNames: doesn't shadow
import { Object } from "@rbxts/jsnatives";
import { type GenericEvent, type GenericEventCaller, createEvent } from "../utils.js";

/**
 * Fires when a state is about to change
 *
 * @extends {GenericEvent<[State, State | undefined]>}
 */
interface OnStateChangeEvent<StateArgsType extends StateArgs> extends GenericEvent<[State<StateArgsType>, State<StateArgsType> | undefined]> { }
/**
 * Caller that fires when a state is about to change
 *
 * @extends {GenericEventCaller<[State, State | undefined]>}
 */
interface OnStateChangeEventCaller<StateArgsType extends StateArgs> extends GenericEventCaller<[State<StateArgsType> | undefined, State<StateArgsType> | undefined]> { }

type StateTransitions<StateArgsType extends StateArgs> = ReadonlyMap<string, (args: StateArgsType) => boolean>;

interface State<StateArgsType extends StateArgs> {
	readonly transitions: StateTransitions<StateArgsType>;
}

interface StateObject<StateArgsType extends StateArgs> {
	/**
	 * Callback for state change event
	 *
	 * @readonly
	 */
	readonly onStateChange: OnStateChangeEvent<StateArgsType>;
	/**
	 * Hidden callback caller for state change event
	 *
	 * @readonly
	 */
	readonly onStateChangeCaller: OnStateChangeEventCaller<StateArgsType>;
	readonly states: States<StateArgsType>;
	readonly id: number;
	currentState: State<StateArgsType> | undefined;
	argsCache: StateArgsType | undefined;
}

interface States<StateArgsType extends StateArgs> {
	readonly [key: string]: State<StateArgsType>;
}

interface StateArgs {
	readonly [key: string]: unknown;
}

/**
 * State controller
 */
class StateController {
	private readonly objects: StateObject<StateArgs>[] = [];

	public createStateObject<StateArgsType extends StateArgs>(states: States<StateArgsType>): StateObject<StateArgsType> {
		const id = this.objects.size();
		const [onStateChange, onStateChangeCaller] = createEvent() as [OnStateChangeEvent<StateArgsType>, OnStateChangeEventCaller<StateArgsType>];

		const newObject: StateObject<StateArgsType> = {
			id,
			states,
			onStateChange,
			onStateChangeCaller,
			currentState: undefined,
			argsCache: undefined
		}

		this.objects.push(newObject as unknown as StateObject<StateArgs>);
		return newObject;
	}

	public removeStateObject(id: number): void {
		this.objects.remove(id);
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	public changeState<StateArgsType extends StateArgs>(object: StateObject<StateArgsType>, state: State<StateArgsType>): void {
		if (state !== object.currentState) {
			object.onStateChangeCaller.fire(state, object.currentState);
			object.currentState = state;
		}
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	public getCurrentState<StateArgsType extends StateArgs>(object: StateObject<StateArgsType>): State<StateArgsType> | undefined {
		return object.currentState;
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private isCacheActual(args: StateArgs, cache: StateArgs | undefined): boolean {
		if (!cache) {
			return false;
		}

		const currentArgs = Object.values(args);
		const cachedArgs = Object.values(cache);

		if (currentArgs.size() !== cachedArgs.size()) {
			return false;
		}

		return currentArgs.every((value, index) => value === cachedArgs[index]);
	}

	public updateState<StateArgsType extends StateArgs>(object: StateObject<StateArgsType>, args: StateArgsType): State<StateArgsType> | undefined {
		if (this.isCacheActual(args, object.argsCache)) {
			return object.currentState;
		}

		let transitions: StateTransitions<StateArgsType> = {} as StateTransitions<StateArgsType>;

		let outputState: State<StateArgsType> | undefined;

		if (object.currentState) {
			(transitions as StateTransitions<StateArgsType>) = object.currentState.transitions;
		} else {
			const defaultState: State<StateArgsType> = object.states.default;

			if (defaultState) {
				(transitions as StateTransitions<StateArgsType>) = defaultState.transitions;
			}
		}

		for (const [candidate, condition] of transitions) {
			if (condition(args)) {
				const newState = this.findStateByName(candidate, object);

				outputState = newState;
			}
		}

		if (outputState) {
			this.changeState(object, outputState);
		}

		object.argsCache = args;

		return outputState;
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private findStateByName<StateArgsType extends StateArgs>(search: string, object: StateObject<StateArgsType>): State<StateArgsType> | undefined {
		let result: State<StateArgsType> | undefined;

		for (const [name, state] of Object.entries(object.states)) {
			if (search === name) {
				result = state;
			}
		}

		return result;
	}
}

/**
 * State controller singleton
 */
export const stateController: StateController = new StateController();

export type { StateObject, State, States, StateArgs };
