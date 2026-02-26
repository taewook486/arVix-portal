// OpenAI manual mock for testing
import { jest } from '@jest/globals';

export const mockCreate = jest.fn();

export class ChatCompletionMock {
  create = mockCreate;
}

export class ChatMock {
  completions = new ChatCompletionMock();
}

const openaiMock = jest.fn(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
}));

// 타입 단언 추가
export default openaiMock as any;
