declare module 'twikoo' {
	export interface TwikooInitOptions {
		envId: string;
		el?: string;
		region?: string;
		path?: string;
		lang?: string;
		timeout?: number;
	}

	export interface TwikooClient {
		init(options?: TwikooInitOptions): Promise<void> | void;
		getCommentsCount?(options?: TwikooInitOptions): Promise<unknown>;
		getRecentComments?(options?: TwikooInitOptions): Promise<unknown>;
		getVisitorsCount?(options?: TwikooInitOptions): Promise<unknown>;
		version?: string;
	}

	const twikoo: TwikooClient;
	export default twikoo;
	export const init: TwikooClient['init'];
}
