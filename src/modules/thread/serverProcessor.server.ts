//!strict

import type { StarterJobArgs } from "../../system/tickManager.js";
import { threadController } from "./index.js";

const selfActor = script.GetActor() as Actor;

selfActor.BindToMessage(threadController.threadRunMessage, <TaskArgs extends StarterJobArgs>(threadId: number, executeFun: ModuleScript, args: TaskArgs) => {
	// biome-ignore lint/style/noCommonJs: procedural module
	const module = require(executeFun) as (funArgs: TaskArgs) => void;

	task.desynchronize();

	module(args);

	task.synchronize();

	threadController.threadFinishedSignal.Fire(threadId, selfActor);
});

threadController.workerReadySignal.Fire(selfActor);
