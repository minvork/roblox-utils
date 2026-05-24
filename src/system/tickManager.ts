//!strict

// biome-ignore lint/suspicious/noShadowRestrictedNames: doesn't shadow
import { Object } from "@rbxts/jsnatives";
import { RunService } from "@rbxts/services";
import { threadController } from "../modules/thread/index.js";
import { GenericError, type WritableKeysOf } from "../utils.js";

/**
 * Thrown when a job lacks its task
 *
 * @export
 * @extends {GenericError}
 */
class JobWithoutTaskError extends GenericError {
	/**
	 * Creates an instance of JobWithoutTaskError
	 *
	 * @constructor
	 * @public
	 * @param {?string} [message] Custom error message
	 */
	public constructor(message?: string) {
		const name = "JobWithoutTaskError";
		super(name, message ?? "A job lacks its task.");
	}
}

interface Job<TaskArgs extends StarterJobArgs> {
	readonly fun: ModuleScript;
	readonly threadSafe: boolean;
	readonly args: TaskArgs;
}

interface DeferredTask<TaskArgs extends StarterJobArgs> extends Job<TaskArgs> {
	timeout: number;
	readonly frameTimeMode: boolean;
}

interface Service<TaskArgs extends StarterJobArgs> extends DeferredTask<TaskArgs> {
	readonly interval: number;
	ttl: number;
	readonly ttlFrameTimeMode: boolean;
}

type Operation<TaskArgs extends StarterJobArgs> = Job<TaskArgs> | DeferredTask<TaskArgs> | Service<TaskArgs>;

interface NewTaskParams<TaskArgs extends StarterJobArgs> {
	readonly task: Task;
	readonly threadSafe: boolean;
	readonly args: Partial<TaskArgs>;
}

interface NewDeferredTaskParams<TaskArgs extends StarterJobArgs> extends NewTaskParams<TaskArgs> {
	timeout: number;
	readonly frameTimeMode: boolean;
}

interface NewServiceParams<TaskArgs extends StarterTaskArgs> extends Omit<NewDeferredTaskParams<TaskArgs>, "timeout"> {
	readonly interval: number;
	readonly ttl: number;
	readonly ttlFrameTimeMode: boolean;
}

/**
 * Tick manager
 */
class TickManager {
	private readonly deferredTasks: Map<number, DeferredTask<StarterTaskArgs>> = new Map<number, DeferredTask<StarterTaskArgs>>();
	private readonly services: Map<number, Service<StarterTaskArgs>> = new Map<number, Service<StarterTaskArgs>>();

	public constructor() {
		RunService.PostSimulation.Connect((frameTime) => this.step(frameTime));
	}

	public runJob<TaskArgs extends StarterJobArgs>(params: NewTaskParams<TaskArgs>): void {
		if (!params.task) {
			throw new JobWithoutTaskError();
		}

		const starterArgs: StarterJobArgs = {
			event: params.task.event
		}

		const newTask: Job<TaskArgs> = {
			fun: params.task.fun,
			threadSafe: params.threadSafe ?? false,
			args: params.args ? Object.assign(starterArgs, params.args) as unknown as TaskArgs : starterArgs as TaskArgs
		}

		this.processJob(newTask);
	}

	public schedule<TaskArgs extends StarterTaskArgs>(params: NewDeferredTaskParams<TaskArgs>): number {
		if (!params.task) {
			throw new JobWithoutTaskError();
		}

		const starterArgs: StarterTaskArgs = {
			task: this.deferredTasks.size(),
			frameTime: 0,
			event: params.task.event
		}

		const newTask: DeferredTask<TaskArgs> = {
			fun: params.task.fun,
			threadSafe: params.threadSafe ?? false,
			args: params.args ? Object.assign(starterArgs, params.args) as unknown as TaskArgs : starterArgs as TaskArgs,
			timeout: params.timeout ?? 0,
			frameTimeMode: params.frameTimeMode ?? false
		}

		this.deferredTasks.set(this.deferredTasks.size(), newTask);

		return this.deferredTasks.size() - 1;
	}

	public createService<TaskArgs extends StarterTaskArgs>(params: Partial<NewServiceParams<TaskArgs>>): number {
		if (!params.task) {
			throw new JobWithoutTaskError();
		}

		const starterArgs: StarterTaskArgs = {
			task: this.services.size(),
			frameTime: 0,
			event: params.task?.event
		}

		const newService: Partial<Service<TaskArgs>> = {
			fun: params.task.fun,
			threadSafe: params.threadSafe ?? false,
			args: params.args ? Object.assign(starterArgs, params.args) as unknown as TaskArgs : starterArgs as TaskArgs,
			timeout: params.interval ?? 0,
			interval: params.interval ?? 0,
			frameTimeMode: params.frameTimeMode ?? false,
			ttlFrameTimeMode: params.ttlFrameTimeMode ?? false
		}

		newService.ttl = (params.ttl === 0 || params.ttl === undefined) ? -1 : params.ttl;

		this.services.set(this.services.size(), newService as Service<TaskArgs>);

		return this.services.size() - 1;
	}

	public drop(task: number): void {
		this.deferredTasks.delete(task);
	}

	public removeService(service: number): void {
		this.services.delete(service);
	}

	private processJob<TaskArgs extends StarterJobArgs>(job: Job<TaskArgs>): void {
		this.placeTaskOnThread(job);
	}

	private processDeferredTasks(frameTime: number): void {
		for (const [id, task] of this.deferredTasks) {
			task.args.frameTime += frameTime;

			if (task.timeout > 0) {
				this.tickTimer(task, "timeout", frameTime);

				continue;
			}

			this.deferredTasks.delete(id);
			this.placeTaskOnThread(task);
		}
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private tickTimer<TaskArgs extends StarterTaskArgs>(timer: DeferredTask<TaskArgs> | Service<TaskArgs>, property: WritableKeysOf<DeferredTask<TaskArgs> & Service<TaskArgs>>, frameTime: number): void {
		if (timer.frameTimeMode) {
			(timer as DeferredTask<TaskArgs> & Service<TaskArgs>)[property] -= frameTime;
		} else {
			(timer as DeferredTask<TaskArgs> & Service<TaskArgs>)[property] -= 1;
		}
	}

	private runServices(frameTime: number): void {
		for (const [id, service] of this.services) {
			service.args.frameTime += frameTime;

			if (service.timeout > 0 && service.interval > 0) {
				this.tickTimer(service, "timeout", frameTime);

				continue;
			}

			if (service.ttl > 0) {
				this.tickTimer(service, "ttl", frameTime);
			} else if (service.ttl !== -1) {
				this.services.delete(id);

				continue;
			}

			service.timeout = service.interval;

			this.placeTaskOnThread(service);
		}
	}

	// biome-ignore lint/nursery/useThisInClassMethods: singletone, forgivable
	private placeTaskOnThread<TaskArgs extends StarterJobArgs>(task: Operation<TaskArgs>): void {
		if (task.threadSafe) {
			threadController.spawn(task.fun, task.args);
		} else {
			// biome-ignore lint/style/noCommonJs: procedural module
			const module = require(task.fun) as (...funArgs: unknown[]) => void;

			module(task.args);
		}
	}

	private step(frameTime: number): void {
		this.processDeferredTasks(frameTime);
		this.runServices(frameTime);
	}
}

/**
 * Tick manager singleton
 */
export const tickManager: TickManager = new TickManager();

export interface StarterJobArgs {
	readonly event: BindableEvent | undefined;
}

export interface StarterTaskArgs extends StarterJobArgs {
	readonly task: number;
	frameTime: number;
}

export interface Task {
	readonly fun: ModuleScript;
	readonly event: BindableEvent | undefined;
}

export type Tasks = {
	readonly [Key in string]: Task;
}
