-- Deduplicate existing responses per (reviewId, pointId), keeping the latest row by id.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "reviewId", "pointId"
      ORDER BY id DESC
    ) AS rn
  FROM "ReviewResponses"
)
DELETE FROM "ReviewResponses"
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

-- Enforce one response per point in a review.
CREATE UNIQUE INDEX "ReviewResponses_reviewId_pointId_key"
ON "ReviewResponses"("reviewId", "pointId");
