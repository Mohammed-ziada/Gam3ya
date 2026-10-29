ALTER TABLE "associations" ADD COLUMN "planned_slots" integer;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "secondary_name" text;--> statement-breakpoint
ALTER TABLE "shares" ADD COLUMN "share_percent" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
CREATE INDEX "members_association_idx" ON "members" USING btree ("association_id");--> statement-breakpoint
CREATE INDEX "monthly_payments_status_idx" ON "monthly_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_member_status_idx" ON "payment_submissions" USING btree ("member_id","status");--> statement-breakpoint
CREATE INDEX "shares_payout_order_idx" ON "shares" USING btree ("payout_order");