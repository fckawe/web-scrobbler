import {
	ApiCallResult,
	ApiCallResultType,
} from '@/background/scrobbler/api-call-result';

import type { LoveStatus } from '@/background/model/song/LoveStatus';
import type { ScrobbleService } from '@/background/scrobbler/ScrobbleService';
import type { ScrobblerId } from '@/background/scrobbler/ScrobblerId';
import type { ScrobblerSession } from '@/background/scrobbler/ScrobblerSession';
import type { ScrobblerInfo } from '@/background/scrobbler/ScrobblerInfo';
import { TrackContextInfo } from '@/background/scrobbler/TrackContextInfo';
import { ScrobbleEntity } from '@/background/scrobbler/ScrobbleEntity';
import { Song } from '@/background/model/song/Song';

export class Scrobbler {
	constructor(
		private session: ScrobblerSession,
		private scrobblerInfo: ScrobblerInfo,
		private scrobbleService: ScrobbleService
	) {}

	getId(): ScrobblerId {
		return this.scrobblerInfo.id;
	}

	getProfileUrl(): string {
		const baseProfileUrl = this.scrobblerInfo.baseProfileUrl;
		if (baseProfileUrl) {
			return `${baseProfileUrl}/${this.session.getName()}`;
		}

		return this.scrobblerInfo.profileUrl ?? null;
	}

	async getTrackContextInfo(song: Song): Promise<TrackContextInfo> {
		return this.scrobbleService.getTrackContextInfo(song);
	}

	async sendNowPlayingRequest(
		scrobbleEntity: ScrobbleEntity
	): Promise<ApiCallResult> {
		try {
			await this.scrobbleService.sendNowPlayingRequest(scrobbleEntity);
			return this.createApiCallResult(ApiCallResult.RESULT_OK);
		} catch (err) {
			throw this.createApiCallResult(ApiCallResult.ERROR_OTHER);
		}
	}

	async sendScrobbleRequest(
		scrobbleEntity: ScrobbleEntity
	): Promise<ApiCallResult> {
		try {
			await this.scrobbleService.sendScrobbleRequest(scrobbleEntity);
			return this.createApiCallResult(ApiCallResult.RESULT_OK);
		} catch (err) {
			throw this.createApiCallResult(ApiCallResult.ERROR_OTHER);
		}
	}

	async sendLoveRequest(
		scrobbleEntity: ScrobbleEntity,
		loveStatus: LoveStatus
	): Promise<ApiCallResult> {
		try {
			await this.scrobbleService.sendLoveRequest(
				scrobbleEntity,
				loveStatus
			);
			return this.createApiCallResult(ApiCallResult.RESULT_OK);
		} catch (err) {
			throw this.createApiCallResult(ApiCallResult.ERROR_OTHER);
		}
	}

	private createApiCallResult(resultType: ApiCallResultType): ApiCallResult {
		return new ApiCallResult(resultType, this.getId());
	}
}
