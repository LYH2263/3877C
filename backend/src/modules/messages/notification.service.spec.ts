import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotificationType, type Prisma } from "@prisma/client";
import {
  createNotificationIfAllowed,
  type CreateNotificationInput
} from "./notification.service.js";

interface NotificationPreference {
  notifyLike: boolean;
  notifyComment: boolean;
  notifyRepost: boolean;
  notifyFollow: boolean;
}

type Mockify<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : T[K] extends object
      ? Mockify<T[K]>
      : T[K];
};

interface MockTx {
  userSettings: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  notification: {
    create: ReturnType<typeof vi.fn>;
  };
}

function createMockTx(settings?: Partial<NotificationPreference> | null): MockTx {
  return {
    userSettings: {
      findUnique: vi.fn().mockResolvedValue(settings === undefined ? null : settings)
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 1 })
    }
  };
}

function buildInput(overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput {
  return {
    targetUserId: 2,
    actorUserId: 1,
    type: NotificationType.LIKE,
    postId: 10,
    content: "test content",
    ...overrides
  };
}

describe("createNotificationIfAllowed", () => {
  describe("自我通知短路", () => {
    it("targetUserId === actorUserId 时直接返回 null", async () => {
      const tx = createMockTx({
        notifyLike: true,
        notifyComment: true,
        notifyRepost: true,
        notifyFollow: true
      });
      const input = buildInput({ targetUserId: 1, actorUserId: 1 });

      const result = await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(result).toBeNull();
      expect(tx.userSettings.findUnique).not.toHaveBeenCalled();
      expect(tx.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("settings 缺失回退默认全开", () => {
    const allTypes: Array<[NotificationType, keyof NotificationPreference]> = [
      [NotificationType.LIKE, "notifyLike"],
      [NotificationType.COMMENT, "notifyComment"],
      [NotificationType.REPOST, "notifyRepost"],
      [NotificationType.FOLLOW, "notifyFollow"]
    ];

    it.each(allTypes)(
      "无 settings 时 %s 默认开启，应创建通知", async (type, prefKey) => {
        const tx = createMockTx(null);
        const input = buildInput({ type, content: "hello" });

        const result = await createNotificationIfAllowed(
          tx as unknown as Prisma.TransactionClient,
          input
        );

        expect(result).toEqual({ id: 1 });
        expect(tx.userSettings.findUnique).toHaveBeenCalledTimes(1);
        expect(tx.userSettings.findUnique).toHaveBeenCalledWith({
          where: { userId: input.targetUserId },
          select: {
            notifyLike: true,
            notifyComment: true,
            notifyRepost: true,
            notifyFollow: true
          }
        });
        expect(tx.notification.create).toHaveBeenCalledTimes(1);
        expect(tx.notification.create).toHaveBeenCalledWith({
          data: {
            targetUserId: input.targetUserId,
            actorUserId: input.actorUserId,
            postId: input.postId,
            type: input.type,
            content: "hello"
          }
        });
      }
      );
  });

  describe("四种 NotificationType 各自开关命中", () => {
    const typeMatrix: Array<{
      type: NotificationType; prefKey: keyof NotificationPreference; enabled: boolean }> = [
        { type: NotificationType.LIKE, prefKey: "notifyLike", enabled: true },
        { type: NotificationType.COMMENT, prefKey: "notifyComment", enabled: true },
        { type: NotificationType.REPOST, prefKey: "notifyRepost", enabled: true },
        { type: NotificationType.FOLLOW, prefKey: "notifyFollow", enabled: true },
        { type: NotificationType.LIKE, prefKey: "notifyLike", enabled: false },
        { type: NotificationType.COMMENT, prefKey: "notifyComment", enabled: false },
        { type: NotificationType.REPOST, prefKey: "notifyRepost", enabled: false },
        { type: NotificationType.FOLLOW, prefKey: "notifyFollow", enabled: false }
      ];

    it.each(typeMatrix)(
      "type=$type enabled=$enabled 时行为正确",
      async ({ type, prefKey, enabled }) => {
        const settings: NotificationPreference = {
          notifyLike: prefKey === "notifyLike" ? enabled : true,
          notifyComment: prefKey === "notifyComment" ? enabled : true,
          notifyRepost: prefKey === "notifyRepost" ? enabled : true,
          notifyFollow: prefKey === "notifyFollow" ? enabled : true
        };
        const tx = createMockTx(settings);
        const input = buildInput({ type, content: "msg" });

        const result = await createNotificationIfAllowed(
          tx as unknown as Prisma.TransactionClient,
          input
        );

        expect(tx.userSettings.findUnique).toHaveBeenCalledTimes(1);

        if (enabled) {
          expect(result).toEqual({ id: 1 });
          expect(tx.notification.create).toHaveBeenCalledTimes(1);
          expect(tx.notification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
              targetUserId: input.targetUserId,
              actorUserId: input.actorUserId,
              postId: input.postId ?? null,
              type: input.type,
              content: "msg"
            })
          });
        } else {
          expect(result).toBeNull();
          expect(tx.notification.create).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe("对应类型开关关闭时返回 null", () => {
    it("notifyLike=false，LIKE 通知被阻止", async () => {
      const tx = createMockTx({
        notifyLike: false,
        notifyComment: true,
        notifyRepost: true,
        notifyFollow: true
      });
      const input = buildInput({ type: NotificationType.LIKE });

      const result = await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(result).toBeNull();
      expect(tx.userSettings.findUnique).toHaveBeenCalledTimes(1);
      expect(tx.notification.create).not.toHaveBeenCalled();
    });

    it("notifyComment=false，COMMENT 通知被阻止", async () => {
      const tx = createMockTx({
        notifyLike: true,
        notifyComment: false,
        notifyRepost: true,
        notifyFollow: true
      });
      const input = buildInput({ type: NotificationType.COMMENT });

      const result = await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(result).toBeNull();
      expect(tx.notification.create).not.toHaveBeenCalled();
    });
  });

  describe("content 的 trim 与 slice(0,240) 截断", () => {
    it("content 前后空白被 trim", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ content: "   hello world   " });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: "hello world" })
      });
    });

    it("content 超过 240 字符被截断", async () => {
      const tx = createMockTx(null);
      const longContent = "a".repeat(300);
      const input = buildInput({ content: longContent });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: "a".repeat(240) })
      });
    });

    it("trim + 截断组合生效", async () => {
      const tx = createMockTx(null);
      const paddedLong = "   " + "b".repeat(250) + "   ";
      const input = buildInput({ content: paddedLong });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: "b".repeat(240) })
      });
    });
  });

  describe("空白 content 归一为 null", () => {
    it("纯空白字符串 trim 后为空归一为 null", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ content: "     " });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: null })
      });
    });

    it("空字符串归一为 null", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ content: "" });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: null })
      });
    });

    it("content 为 null 时归一为 null", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ content: null });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: null })
      });
    });

    it("content 为 undefined 时归一为 null", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ content: undefined });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: null })
      });
    });
  });

  describe("postId 边界", () => {
    it("postId 为 null 时传 null", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ postId: null });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ postId: null })
      });
    });

    it("postId 为 undefined 时归一为 null", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ postId: undefined });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ postId: null })
      });
    });

    it("FOLLOW 类型无 postId 正常创建", async () => {
      const tx = createMockTx(null);
      const input = buildInput({ type: NotificationType.FOLLOW, postId: undefined });

      await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ postId: null, type: NotificationType.FOLLOW })
      });
    });
  });

  describe("组合场景", () => {
    it("自我通知 + settings 存在但不应被查询", async () => {
      const tx = createMockTx({
        notifyLike: false,
        notifyComment: false,
        notifyRepost: false,
        notifyFollow: false
      });
      const input = buildInput({ targetUserId: 5, actorUserId: 5, type: NotificationType.LIKE });

      const result = await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(result).toBeNull();
      expect(tx.userSettings.findUnique).not.toHaveBeenCalled();
      expect(tx.notification.create).not.toHaveBeenCalled();
    });

    it("settings 存在 + 开关开 + content 超长截断", async () => {
      const tx = createMockTx({
        notifyLike: true,
        notifyComment: true,
        notifyRepost: true,
        notifyFollow: true
      });
      const content = "x".repeat(500);
      const input = buildInput({ content });

      const result = await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(result).toEqual({ id: 1 });
      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: "x".repeat(240) })
      });
    });

    it("settings 存在 + 开关关 + content 超长仍不创建", async () => {
      const tx = createMockTx({
        notifyLike: false,
        notifyComment: true,
        notifyRepost: true,
        notifyFollow: true
      });
      const input = buildInput({ content: "should not appear" });

      const result = await createNotificationIfAllowed(
        tx as unknown as Prisma.TransactionClient,
        input
      );

      expect(result).toBeNull();
      expect(tx.notification.create).not.toHaveBeenCalled();
    });
  });
});
