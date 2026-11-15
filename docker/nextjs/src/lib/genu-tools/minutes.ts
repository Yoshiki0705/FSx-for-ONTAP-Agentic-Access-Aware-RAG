/**
 * Meeting minutes: Amazon Transcribe turns an uploaded recording into a transcript with
 * speaker labels, and a text model writes minutes from the transcript. Transcribe jobs run
 * for minutes, so this is two calls from the browser: `minutes-start` creates the job and
 * `minutes-status` is polled until the job is finished, then returns the transcript and
 * the minutes. Needs the media bucket (see media.ts).
 *
 * A job name carries the hash of the user id, and `minutes-status` refuses a name that does
 * not, so one user cannot read another user's transcript.
 */
import { randomUUID } from 'node:crypto';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { GetTranscriptionJobCommand, StartTranscriptionJobCommand, TranscribeClient } from '@aws-sdk/client-transcribe';
import { checkOwnObject, mediaToolsEnabled, s3Client, userPrefix } from './media';
import { minutesPrompt, wrapInput } from './prompts';
import { generateText, MAX_INPUT_CHARS, ToolInputError } from './text-model';

export const TRANSCRIBE_LANGUAGES = ['ja-JP', 'en-US', 'ko-KR', 'zh-CN', 'fr-FR', 'de-DE', 'es-ES'] as const;
const JOB_PREFIX = 'rag-minutes-';
const MAX_SPEAKERS = 10;

let client: TranscribeClient | null = null;
function transcribe(): TranscribeClient {
  client ??= new TranscribeClient({ region: process.env.AWS_REGION || 'ap-northeast-1', maxAttempts: 3 });
  return client;
}
/** Tests replace the client. */
export function __setTranscribeClient(c: { send: (cmd: unknown) => Promise<unknown> } | null): void {
  client = c as TranscribeClient | null;
}

function userHash(userId: string): string {
  // `uploads/<hash>/` -> <hash>
  return userPrefix(userId).split('/')[1];
}

export async function startMinutes(
  userId: string,
  input: { key: string; language: string; speakers: number },
): Promise<{ jobName: string; status: string }> {
  if (!mediaToolsEnabled()) throw new ToolInputError('media tools are not enabled');
  if (!(TRANSCRIBE_LANGUAGES as readonly string[]).includes(input.language)) {
    throw new ToolInputError(`unsupported language: ${input.language}`);
  }
  const speakers = Math.min(Math.max(Math.trunc(input.speakers) || 2, 2), MAX_SPEAKERS);
  const obj = await checkOwnObject(userId, input.key, 'audio');
  const jobName = `${JOB_PREFIX}${userHash(userId)}-${randomUUID()}`;
  await transcribe().send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: input.language as 'ja-JP',
      Media: { MediaFileUri: `s3://${obj.bucket}/${input.key}` },
      OutputBucketName: obj.bucket,
      OutputKey: `transcripts/${userHash(userId)}/${jobName}.json`,
      Settings: { ShowSpeakerLabels: true, MaxSpeakerLabels: speakers },
    }),
  );
  return { jobName, status: 'IN_PROGRESS' };
}

interface Segment {
  speaker_label?: string;
  transcript?: string;
}

/** Transcribe's JSON to `spk_0: text` lines; falls back to the plain transcript. */
export function transcriptText(json: unknown): string {
  const results = (json as { results?: { audio_segments?: Segment[]; transcripts?: { transcript?: string }[] } })?.results;
  const segments = results?.audio_segments;
  if (segments && segments.length > 0) {
    const lines: string[] = [];
    let last = '';
    for (const seg of segments) {
      const who = seg.speaker_label || 'spk_?';
      const text = (seg.transcript || '').trim();
      if (!text) continue;
      if (who === last && lines.length > 0) lines[lines.length - 1] += text;
      else lines.push(`${who}: ${text}`);
      last = who;
    }
    return lines.join('\n');
  }
  return (results?.transcripts || []).map((t) => t.transcript || '').join('\n').trim();
}

export async function minutesStatus(
  userId: string,
  input: { jobName: string; language: string },
): Promise<{ status: string; transcript?: string; minutes?: string; truncated?: boolean; modelId?: string; reason?: string }> {
  if (!mediaToolsEnabled()) throw new ToolInputError('media tools are not enabled');
  const own = `${JOB_PREFIX}${userHash(userId)}-`;
  if (typeof input.jobName !== 'string' || !input.jobName.startsWith(own) || !/^[A-Za-z0-9._-]{1,200}$/.test(input.jobName)) {
    throw new ToolInputError('job not found');
  }
  const got = (await transcribe().send(new GetTranscriptionJobCommand({ TranscriptionJobName: input.jobName }))) as {
    TranscriptionJob?: { TranscriptionJobStatus?: string; FailureReason?: string };
  };
  const status = got.TranscriptionJob?.TranscriptionJobStatus || 'UNKNOWN';
  if (status === 'FAILED') return { status, reason: (got.TranscriptionJob?.FailureReason || '').slice(0, 300) };
  if (status !== 'COMPLETED') return { status };
  const body = await s3Client().send(
    new GetObjectCommand({
      Bucket: process.env.MEDIA_BUCKET_NAME,
      Key: `transcripts/${userHash(userId)}/${input.jobName}.json`,
    }),
  );
  const transcript = transcriptText(JSON.parse((await body.Body?.transformToString('utf-8')) || '{}'));
  if (!transcript) return { status, transcript: '', minutes: '', reason: 'no speech was recognized' };
  const truncated = transcript.length > MAX_INPUT_CHARS - 100;
  const out = await generateText({
    system: minutesPrompt(input.language),
    user: wrapInput(transcript.slice(0, MAX_INPUT_CHARS - 100)),
    maxTokens: 4096,
    temperature: 0.2,
  });
  return { status, transcript, minutes: out.text, truncated, modelId: out.modelId };
}
