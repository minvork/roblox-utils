//!strict

import { RunService, Players, ServerScriptService } from "@rbxts/services";
import { threadFolder } from "../../res/definitions";
import type { StarterJobArgs } from "../../system/tickManager";

class ThreadController {
	private readonly threadActorName = "threadActor";
	public readonly threadRunMessage = "runThread";

	private readonly runContextIsClient: boolean;
	private readonly processorToUse: Script | LocalScript;
	private readonly processorParent: Instance;

	private spawnedThreadId = 0;
	private readonly threadWatchers = new Map<number, thread[]>();

	private readonly freeActors: Actor[] = [];
	private readonly actorTaskQueues = new Map<Actor, (() => void)[]>();
	private readonly readyActors = new Set<Actor>();

	public readonly threadFinishedSignal: BindableEvent;
	public readonly workerReadySignal: BindableEvent;

	private readonly workerReadyConnection: RBXScriptConnection;
	private readonly threadFinishedConnection: RBXScriptConnection;

	public constructor() {
		this.runContextIsClient = RunService.IsClient();

		const clientProcessor = script.FindFirstChild("clientProcessor") as LocalScript;
		const serverProcessor = script.FindFirstChild("serverProcessor") as Script;

		this.processorToUse = this.runContextIsClient ? clientProcessor : serverProcessor;
		this.processorParent = this.runContextIsClient
			? (Players.LocalPlayer.FindFirstChild("PlayerScripts") as PlayerScripts)
			: ServerScriptService;

		this.threadFinishedSignal = threadFolder?.FindFirstChild("threadFinished") as BindableEvent;
		this.workerReadySignal = threadFolder?.FindFirstChild("workerReady") as BindableEvent;

		this.workerReadyConnection = this.workerReadySignal.Event.Connect((actor: Actor) => {
			this.readyActors.add(actor);
			this.processNextTaskForActor(actor);
		});

		this.threadFinishedConnection = this.threadFinishedSignal.Event.Connect(
			(threadId: number, actor: Actor) => {
				const watcherArray = this.threadWatchers.get(threadId);

				if (watcherArray) {
					for (const watcher of watcherArray) {
						coroutine.resume(watcher);
					}
					this.threadWatchers.delete(threadId);
				}

				this.readyActors.add(actor);
				this.processNextTaskForActor(actor);
			},
		);
	}

	public spawn<TaskArgs extends StarterJobArgs>(executeFun: ModuleScript, args: TaskArgs): number {
		this.spawnedThreadId += 1;
		const threadId = this.spawnedThreadId;

		const taskSender = (): void => {
			this.threadWatchers.set(threadId, []);
			this.sendTaskToActor(actor, threadId, executeFun, args);
		};

		let actor = this.freeActors.pop() as Actor;
		if (!actor) {
			actor = this.buildActor();
		}

		if (this.readyActors.has(actor) && !this.actorTaskQueues.get(actor)?.size()) {
			taskSender();
		} else {
			let queue = this.actorTaskQueues.get(actor);
			if (!queue) {
				queue = [];
				this.actorTaskQueues.set(actor, queue);
			}
			queue.push(taskSender);

			if (this.readyActors.has(actor)) {
				this.processNextTaskForActor(actor);
			}
		}

		return threadId;
	}

	public join(threadSpecifier: number | number[]): void {
		if (typeIs(threadSpecifier, "table")) {
			for (const threadId of threadSpecifier as number[]) {
				const watcherArray = this.threadWatchers.get(threadId);

				if (!watcherArray) {
					continue;
				}

				watcherArray.push(coroutine.running());
				coroutine.yield();
			}
		} else {
			const watcherArray = this.threadWatchers.get(threadSpecifier);

			if (!watcherArray) {
				return;
			}

			watcherArray.push(coroutine.running());
			coroutine.yield();
		}
	}

	public destroy(): void {
		this.workerReadyConnection.Disconnect();
		this.threadFinishedConnection.Disconnect();
	}

	private buildActor(): Actor {
		const actor = new Instance("Actor");
		actor.Name = this.threadActorName;
		actor.Parent = this.processorParent;

		const processor = this.processorToUse.Clone();
		processor.Parent = actor;
		processor.Enabled = true;

		return actor;
	}

	private sendTaskToActor<TaskArgs extends StarterJobArgs>(actor: Actor, threadId: number, executeFun: ModuleScript, args: TaskArgs): void {
		this.readyActors.delete(actor);
		actor.SendMessage(this.threadRunMessage, threadId, executeFun, args);
	}

	private processNextTaskForActor(actor: Actor): void {
		const queue = this.actorTaskQueues.get(actor);
		if (!queue || queue.size() === 0) {
			if (!this.freeActors.includes(actor)) {
				this.freeActors.push(actor);
			}
			return;
		}

		if (this.readyActors.has(actor)) {
			const nextTask = queue.shift();

			if (nextTask) {
				nextTask();
			}
		}
	}
}

export const threadController = new ThreadController();
