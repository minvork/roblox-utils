//!strict

import type { ViewportSizePromiseTaskArgs } from "../../definitions";

export = (args: ViewportSizePromiseTaskArgs): void => {
	if (args.camera.ViewportSize.X > 0) {
		args.event?.Fire();
	}
}
