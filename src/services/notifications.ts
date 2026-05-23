export type NotificationEvent =
  | { type: "status_changed"; threadId: string; status: string; userId: string }
  | { type: "needs_user_input"; threadId: string; userId: string; reason: string };

export interface NotificationService {
  notifyUser(userId: string, event: NotificationEvent): Promise<void>;
}

/** V2 placeholder — frontend polls until push notifications exist. */
export class NoopNotificationService implements NotificationService {
  async notifyUser(_userId: string, _event: NotificationEvent): Promise<void> {
    // intentionally empty
  }
}
