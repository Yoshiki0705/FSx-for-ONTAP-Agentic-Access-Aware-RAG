/**
 * deleteEpisode: 削除の前に、記録が呼び出した利用者の名前空間にあることを確かめる。
 * SDK のクライアントは置き換え、外部へ呼び出しを出さない。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => {
  process.env.AGENTCORE_MEMORY_ID = 'mem-test';
  return { send: vi.fn() };
});

vi.mock('@aws-sdk/client-bedrock-agentcore', () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    BedrockAgentCoreClient: class {
      send = send;
    },
    RetrieveMemoryRecordsCommand: class extends Command {},
    GetMemoryRecordCommand: class extends Command {},
    DeleteMemoryRecordCommand: class extends Command {},
  };
});

import { deleteEpisode, EpisodeNotFoundError } from '@/lib/agentcore/episodic-memory';
import {
  GetMemoryRecordCommand,
  DeleteMemoryRecordCommand,
} from '@aws-sdk/client-bedrock-agentcore';

const deletes = () =>
  send.mock.calls.filter(([cmd]) => cmd instanceof DeleteMemoryRecordCommand);

describe('deleteEpisode の所有者確認', () => {
  beforeEach(() => {
    send.mockReset();
  });

  it('自分の名前空間の記録は削除される', async () => {
    send.mockImplementation(async (cmd: unknown) =>
      cmd instanceof GetMemoryRecordCommand
        ? { memoryRecord: { namespaces: ['user-a'] } }
        : {}
    );
    await deleteEpisode('rec-1', 'user-a');
    expect(deletes()).toHaveLength(1);
    expect((deletes()[0][0] as any).input).toEqual({
      memoryId: 'mem-test',
      memoryRecordId: 'rec-1',
    });
  });

  it('userId/ で始まる名前空間の記録は削除される', async () => {
    send.mockImplementation(async (cmd: unknown) =>
      cmd instanceof GetMemoryRecordCommand
        ? { memoryRecord: { namespaces: ['user-a/episodic'] } }
        : {}
    );
    await deleteEpisode('rec-1', 'user-a');
    expect(deletes()).toHaveLength(1);
  });

  it('他の利用者の記録は EpisodeNotFoundError で拒否され、削除は送られない', async () => {
    send.mockImplementation(async () => ({ memoryRecord: { namespaces: ['user-b'] } }));
    await expect(deleteEpisode('rec-2', 'user-a')).rejects.toBeInstanceOf(EpisodeNotFoundError);
    expect(deletes()).toHaveLength(0);
  });

  it('名前の前方が同じ別の利用者の記録も拒否される', async () => {
    send.mockImplementation(async () => ({ memoryRecord: { namespaces: ['user-a2'] } }));
    await expect(deleteEpisode('rec-3', 'user-a')).rejects.toBeInstanceOf(EpisodeNotFoundError);
    expect(deletes()).toHaveLength(0);
  });

  it('記録がないとき（ResourceNotFoundException）は EpisodeNotFoundError で、削除は送られない', async () => {
    send.mockImplementation(async () => {
      const e = new Error('not found');
      e.name = 'ResourceNotFoundException';
      throw e;
    });
    await expect(deleteEpisode('rec-4', 'user-a')).rejects.toBeInstanceOf(EpisodeNotFoundError);
    expect(deletes()).toHaveLength(0);
  });

  it('userId が空のときは何も送らずに EpisodeNotFoundError', async () => {
    await expect(deleteEpisode('rec-5', '')).rejects.toBeInstanceOf(EpisodeNotFoundError);
    expect(send).not.toHaveBeenCalled();
  });

  it('それ以外の失敗は投げ直される', async () => {
    send.mockImplementation(async () => {
      throw new Error('network');
    });
    await expect(deleteEpisode('rec-6', 'user-a')).rejects.toThrow('network');
    expect(deletes()).toHaveLength(0);
  });
});
