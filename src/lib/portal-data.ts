import "server-only";
import { prisma } from "./db";

export async function counts(userId: string) {
  const [unread, urgentOpen, followUps] = await Promise.all([
    prisma.feedback.count({ where: { reads: { none: { userId } } } }),
    prisma.feedback.count({ where: { urgent: true, status: { not: "RESOLVED" } } }),
    prisma.feedback.count({ where: { followUp: true, status: { not: "RESOLVED" } } }),
  ]);
  return { unread, urgentOpen, followUps };
}
