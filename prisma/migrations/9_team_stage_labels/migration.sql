-- Per-team display names for board stages (e.g. the Printing team sees "Designing Completed" as "Waiting to print").
ALTER TABLE "Team" ADD COLUMN "stageLabels" JSONB;
