import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const associationStatus = pgEnum("association_status", ["active", "completed", "paused"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "pending", "paid", "rejected"]);
export const payoutStatus = pgEnum("payout_status", ["upcoming", "delivered"]);

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  recoveryHash: text("recovery_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").references(() => admins.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const associations = pgTable("associations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  installmentAmount: integer("installment_amount").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  paymentDay: integer("payment_day").notNull(),
  status: associationStatus("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  associationId: uuid("association_id").references(() => associations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  publicToken: text("public_token").notNull().unique(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shares = pgTable("shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  payoutOrder: integer("payout_order").notNull(),
  payoutStatus: payoutStatus("payout_status").default("upcoming").notNull(),
  payoutProofKey: text("payout_proof_key"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("shares_member_order_idx").on(table.memberId, table.payoutOrder)]);

export const paymentSubmissions = pgTable("payment_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }).notNull(),
  amount: integer("amount").notNull(),
  proofKey: text("proof_key").notNull(),
  status: paymentStatus("status").default("pending").notNull(),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const monthlyPayments = pgTable("monthly_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }).notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  amount: integer("amount").notNull(),
  status: paymentStatus("status").default("unpaid").notNull(),
  submissionId: uuid("submission_id").references(() => paymentSubmissions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("monthly_payments_member_cycle_idx").on(table.memberId, table.cycleNumber)]);

export type Association = typeof associations.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Share = typeof shares.$inferSelect;
